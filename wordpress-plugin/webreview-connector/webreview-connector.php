<?php
/**
 * Plugin Name: WebReview Connector
 * Description: Lets WebReview Pro read pages and apply approved fixes (Elementor, Divi, Gutenberg, site CSS) safely, with a backup before every change and one-click undo.
 * Version: 0.3.0
 * Requires at least: 5.6
 * Requires PHP: 7.4
 * Author: YourDigitalAgents
 * License: GPL-2.0-or-later
 *
 * How it connects: the WebReview app calls this plugin's REST API (/wp-json/webreview/v1/...) using a WordPress
 * Application Password of a dedicated user. Only users an administrator allows under Settings > WebReview
 * Connector (plus administrators) can use it. It never edits plugins, themes, PHP files or users.
 */

if (!defined('ABSPATH')) {
	exit;
}

define('WEBREVIEW_CONNECTOR_VERSION', '0.3.0');
const WEBREVIEW_CAP = 'webreview_agent';
const WEBREVIEW_SNAPSHOT_TYPE = 'webreview_snapshot';
const WEBREVIEW_CSS_OPTION = 'webreview_custom_css';
const WEBREVIEW_ALLOWED_USERS_OPTION = 'webreview_allowed_users';

// ---------------------------------------------------------------------------------------------------------------------
// Permissions: administrators, plus users an administrator allows on the settings page.
// ---------------------------------------------------------------------------------------------------------------------

function webreview_user_is_allowed($user_id = 0) {
	$user_id = $user_id ?: get_current_user_id();
	if (!$user_id) {
		return false;
	}
	if (user_can($user_id, 'manage_options')) {
		return true;
	}
	$allowed = (array) get_option(WEBREVIEW_ALLOWED_USERS_OPTION, array());
	return in_array((int) $user_id, array_map('intval', $allowed), true) && user_can($user_id, 'edit_pages');
}

function webreview_permission() {
	// A wrong or revoked Application Password leaves the request logged out
	if (!is_user_logged_in()) {
		return new WP_Error('webreview_not_logged_in', 'The username or Application Password was not accepted.', array('status' => 401));
	}
	if (!webreview_user_is_allowed()) {
		return new WP_Error('webreview_forbidden', 'This user is not allowed to use WebReview Connector. An administrator can allow it under Settings > WebReview Connector.', array('status' => 403));
	}
	return true;
}

function webreview_post_permission(WP_REST_Request $request) {
	$allowed = webreview_permission();
	if (is_wp_error($allowed)) {
		return $allowed;
	}
	$post_id = (int) $request['id'];
	if (!get_post($post_id)) {
		return new WP_Error('webreview_not_found', 'Page not found.', array('status' => 404));
	}
	if (!current_user_can('edit_post', $post_id)) {
		return new WP_Error('webreview_forbidden', 'This user cannot edit that page.', array('status' => 403));
	}
	return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Builder detection
// ---------------------------------------------------------------------------------------------------------------------

function webreview_active_builders() {
	$theme = wp_get_theme();
	return array(
		'elementor' => defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : null,
		'divi' => (in_array($theme->get_template(), array('Divi', 'Extra'), true) || defined('ET_BUILDER_PLUGIN_VERSION'))
			? ($theme->get('Version') ?: (defined('ET_BUILDER_PLUGIN_VERSION') ? ET_BUILDER_PLUGIN_VERSION : 'active'))
			: null,
		'gutenberg' => function_exists('use_block_editor_for_post_type') ? get_bloginfo('version') : null,
	);
}

function webreview_page_builder($post_id) {
	if (get_post_meta($post_id, '_elementor_edit_mode', true) === 'builder') {
		return 'elementor';
	}
	if (get_post_meta($post_id, '_et_pb_use_builder', true) === 'on') {
		return 'divi';
	}
	$post = get_post($post_id);
	if ($post && function_exists('has_blocks') && has_blocks($post->post_content)) {
		return 'gutenberg';
	}
	return 'classic';
}

function webreview_elementor_data($post_id) {
	$raw = get_post_meta($post_id, '_elementor_data', true);
	if (is_array($raw)) {
		return $raw;
	}
	$data = json_decode((string) $raw, true);
	return is_array($data) ? $data : array();
}

// Find an Elementor element by id anywhere in the tree; returns a reference so it can be edited in place.
function &webreview_find_elementor_element(array &$elements, $element_id) {
	$null = null;
	foreach ($elements as &$element) {
		if (isset($element['id']) && $element['id'] === $element_id) {
			return $element;
		}
		if (!empty($element['elements']) && is_array($element['elements'])) {
			$found = &webreview_find_elementor_element($element['elements'], $element_id);
			if ($found !== null) {
				return $found;
			}
		}
	}
	return $null;
}

// Regenerate only this page's Elementor CSS file, in place (never clear the whole site's CSS cache)
function webreview_clear_elementor_css($post_id) {
	if (!class_exists('\Elementor\Core\Files\CSS\Post')) {
		return;
	}
	$css = \Elementor\Core\Files\CSS\Post::create($post_id);
	if ($css && method_exists($css, 'update')) {
		$css->update();
	}
}

// Divi keeps generated CSS per page (et-cache); drop it so the page is rebuilt with the change
function webreview_clear_divi_cache($post_id) {
	if (class_exists('ET_Core_PageResource')) {
		ET_Core_PageResource::remove_static_resources($post_id, 'all');
	}
	if (function_exists('et_core_clear_wp_cache')) {
		et_core_clear_wp_cache($post_id);
	}
}

// Fingerprint of what a change edits (page builder data, page content or site CSS). WebReview sends the fingerprint it
// saw; if the page changed since, the change is refused instead of overwriting someone else's edit.
function webreview_target_hash($kind, $post_id = 0) {
	if ($kind === 'css') {
		return md5((string) get_option(WEBREVIEW_CSS_OPTION, ''));
	}
	if ($kind === 'elementor') {
		$raw = get_post_meta($post_id, '_elementor_data', true);
		return md5(is_string($raw) ? $raw : wp_json_encode($raw));
	}
	$post = get_post($post_id);
	return md5($post ? (string) $post->post_content : '');
}

function webreview_check_expected_hash(WP_REST_Request $request, $kind, $post_id = 0) {
	$expected = (string) $request['expected_hash'];
	if ($expected !== '' && !hash_equals(webreview_target_hash($kind, $post_id), $expected)) {
		return new WP_Error('webreview_changed', 'The page changed after this fix was prepared. Prepare the fix again.', array('status' => 409));
	}
	return true;
}

// Text that ends up in the page: remove scripts and other unsafe HTML unless the user may post raw HTML
function webreview_clean_settings($value) {
	if (is_array($value)) {
		return array_map('webreview_clean_settings', $value);
	}
	if (is_string($value) && !current_user_can('unfiltered_html')) {
		return wp_kses_post($value);
	}
	return $value;
}

// ---------------------------------------------------------------------------------------------------------------------
// Snapshots: a backup is taken before every change so any change can be undone.
// ---------------------------------------------------------------------------------------------------------------------

add_action('init', function () {
	register_post_type(WEBREVIEW_SNAPSHOT_TYPE, array(
		'public' => false,
		'show_ui' => false,
		'supports' => array('title'),
	));
});

/**
 * @param string $kind  'elementor' | 'content' | 'css'
 * @param array  $data  what is needed to restore: post_id + previous value
 */
function webreview_create_snapshot($kind, array $data, $summary, $request_id = '') {
	$snapshot_id = wp_insert_post(array(
		'post_type' => WEBREVIEW_SNAPSHOT_TYPE,
		'post_status' => 'private',
		'post_title' => wp_strip_all_tags($summary),
		'post_content' => wp_slash(wp_json_encode($data)),
	), true);
	if (is_wp_error($snapshot_id)) {
		return $snapshot_id;
	}
	update_post_meta($snapshot_id, '_webreview_kind', $kind);
	update_post_meta($snapshot_id, '_webreview_post_id', isset($data['post_id']) ? (int) $data['post_id'] : 0);
	update_post_meta($snapshot_id, '_webreview_user_id', get_current_user_id());
	if ($request_id) {
		update_post_meta($snapshot_id, '_webreview_request_id', sanitize_text_field($request_id));
	}
	return $snapshot_id;
}

// After a change: remember the fingerprint it produced, so undo can tell if someone edited the page since
function webreview_mark_snapshot_applied($snapshot_id, $kind, $post_id = 0) {
	update_post_meta($snapshot_id, '_webreview_after_hash', webreview_target_hash($kind, $post_id));
}

function webreview_snapshot_to_array($post) {
	return array(
		'id' => $post->ID,
		'kind' => get_post_meta($post->ID, '_webreview_kind', true),
		'post_id' => (int) get_post_meta($post->ID, '_webreview_post_id', true),
		'summary' => $post->post_title,
		'user_id' => (int) get_post_meta($post->ID, '_webreview_user_id', true),
		'request_id' => get_post_meta($post->ID, '_webreview_request_id', true),
		'reverted' => (bool) get_post_meta($post->ID, '_webreview_reverted', true),
		'created' => get_post_time('c', true, $post),
	);
}

// ---------------------------------------------------------------------------------------------------------------------
// Site CSS managed by WebReview (works with any builder or theme). Versioned through snapshots.
// ---------------------------------------------------------------------------------------------------------------------

add_action('wp_head', function () {
	$css = (string) get_option(WEBREVIEW_CSS_OPTION, '');
	if ($css !== '') {
		echo "\n<style id=\"webreview-css\">\n" . wp_strip_all_tags($css) . "\n</style>\n";
	}
}, 999);

// ---------------------------------------------------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------------------------------------------------

add_action('rest_api_init', function () {
	$ns = 'webreview/v1';

	// Connection check: who is connected, which builders are active.
	register_rest_route($ns, '/status', array(
		'methods' => 'GET',
		'permission_callback' => 'webreview_permission',
		'callback' => function () {
			$user = wp_get_current_user();
			return array(
				'plugin_version' => WEBREVIEW_CONNECTOR_VERSION,
				'wordpress_version' => get_bloginfo('version'),
				'site_url' => home_url('/'),
				'site_name' => get_bloginfo('name'),
				'user' => array('id' => $user->ID, 'name' => $user->display_name, 'roles' => $user->roles),
				'builders' => webreview_active_builders(),
			);
		},
	));

	// Which WordPress page is this URL, and which builder made it?
	register_rest_route($ns, '/resolve', array(
		'methods' => 'GET',
		'permission_callback' => 'webreview_permission',
		'args' => array('url' => array('required' => true, 'type' => 'string')),
		'callback' => function (WP_REST_Request $request) {
			$url = esc_url_raw($request['url']);
			$post_id = url_to_postid($url);
			if (!$post_id) {
				$path = trim((string) wp_parse_url($url, PHP_URL_PATH), '/');
				$home_path = trim((string) wp_parse_url(home_url('/'), PHP_URL_PATH), '/');
				if ($path === $home_path && get_option('show_on_front') === 'page') {
					$post_id = (int) get_option('page_on_front');
				}
			}
			if (!$post_id) {
				return new WP_Error('webreview_not_found', 'No WordPress page matches this URL.', array('status' => 404));
			}
			$post = get_post($post_id);
			return array(
				'post_id' => $post_id,
				'post_type' => $post->post_type,
				'title' => get_the_title($post),
				'builder' => webreview_page_builder($post_id),
				'permalink' => get_permalink($post),
				'can_edit' => current_user_can('edit_post', $post_id),
			);
		},
	));

	// Read a page's builder data.
	register_rest_route($ns, '/page/(?P<id>\d+)', array(
		'methods' => 'GET',
		'permission_callback' => 'webreview_post_permission',
		'callback' => function (WP_REST_Request $request) {
			$post_id = (int) $request['id'];
			$post = get_post($post_id);
			$builder = webreview_page_builder($post_id);
			$response = array(
				'post_id' => $post_id,
				'title' => get_the_title($post),
				'builder' => $builder,
				'modified' => get_post_modified_time('c', true, $post),
				'hash' => webreview_target_hash($builder === 'elementor' ? 'elementor' : 'content', $post_id),
				// WordPress adds this class to <body>, so CSS can be limited to this page
				'body_class' => ($post->post_type === 'page' ? 'page-id-' : 'postid-') . $post_id,
			);
			if ($builder === 'elementor') {
				$response['elementor'] = webreview_elementor_data($post_id);
			} else {
				$response['content'] = $post->post_content;
				if ($builder === 'gutenberg' && function_exists('parse_blocks')) {
					$response['blocks'] = parse_blocks($post->post_content);
				}
			}
			return $response;
		},
	));

	// Elementor: change one element's settings (merged into the existing settings).
	register_rest_route($ns, '/page/(?P<id>\d+)/elementor-element', array(
		'methods' => 'POST',
		'permission_callback' => 'webreview_post_permission',
		'args' => array(
			'element_id' => array('required' => true, 'type' => 'string'),
			'settings' => array('required' => true, 'type' => 'object'),
		),
		'callback' => function (WP_REST_Request $request) {
			$post_id = (int) $request['id'];
			if (webreview_page_builder($post_id) !== 'elementor') {
				return new WP_Error('webreview_wrong_builder', 'This page is not built with Elementor.', array('status' => 400));
			}
			$unchanged = webreview_check_expected_hash($request, 'elementor', $post_id);
			if (is_wp_error($unchanged)) {
				return $unchanged;
			}
			$raw_before = get_post_meta($post_id, '_elementor_data', true);
			$data = webreview_elementor_data($post_id);
			$element = &webreview_find_elementor_element($data, (string) $request['element_id']);
			if ($element === null) {
				return new WP_Error('webreview_element_not_found', 'Element not found on this page.', array('status' => 404));
			}
			$snapshot_id = webreview_create_snapshot('elementor', array(
				'post_id' => $post_id,
				'elementor_data' => is_string($raw_before) ? $raw_before : wp_json_encode($raw_before),
			), (string) ($request['summary'] ?: 'Elementor element ' . $request['element_id']), (string) $request['request_id']);
			if (is_wp_error($snapshot_id)) {
				return $snapshot_id;
			}
			$settings = isset($element['settings']) && is_array($element['settings']) ? $element['settings'] : array();
			$element['settings'] = array_merge($settings, webreview_clean_settings((array) $request['settings']));
			update_post_meta($post_id, '_elementor_data', wp_slash(wp_json_encode($data)));
			webreview_clear_elementor_css($post_id);
			webreview_mark_snapshot_applied($snapshot_id, 'elementor', $post_id);
			return array('ok' => true, 'snapshot_id' => $snapshot_id, 'element' => $element);
		},
	));

	// Gutenberg / Divi (shortcodes or Divi 5 blocks) / classic: replace the page content (WordPress also keeps its own revision).
	register_rest_route($ns, '/page/(?P<id>\d+)/content', array(
		'methods' => 'POST',
		'permission_callback' => 'webreview_post_permission',
		'args' => array('content' => array('required' => true, 'type' => 'string')),
		'callback' => function (WP_REST_Request $request) {
			$post_id = (int) $request['id'];
			if (webreview_page_builder($post_id) === 'elementor') {
				return new WP_Error('webreview_wrong_builder', 'Elementor pages are edited per element.', array('status' => 400));
			}
			$unchanged = webreview_check_expected_hash($request, 'content', $post_id);
			if (is_wp_error($unchanged)) {
				return $unchanged;
			}
			$post = get_post($post_id);
			$snapshot_id = webreview_create_snapshot('content', array(
				'post_id' => $post_id,
				'content' => $post->post_content,
			), (string) ($request['summary'] ?: 'Page content'), (string) $request['request_id']);
			if (is_wp_error($snapshot_id)) {
				return $snapshot_id;
			}
			$result = wp_update_post(array('ID' => $post_id, 'post_content' => wp_slash((string) $request['content'])), true);
			if (is_wp_error($result)) {
				return $result;
			}
			if (webreview_page_builder($post_id) === 'divi') {
				webreview_clear_divi_cache($post_id);
			}
			webreview_mark_snapshot_applied($snapshot_id, 'content', $post_id);
			return array('ok' => true, 'snapshot_id' => $snapshot_id);
		},
	));

	// Site CSS managed by WebReview.
	register_rest_route($ns, '/css', array(
		array(
			'methods' => 'GET',
			'permission_callback' => 'webreview_permission',
			'callback' => function () {
				return array('css' => (string) get_option(WEBREVIEW_CSS_OPTION, ''), 'hash' => webreview_target_hash('css'));
			},
		),
		array(
			'methods' => 'POST',
			'permission_callback' => 'webreview_permission',
			'args' => array('css' => array('required' => true, 'type' => 'string')),
			'callback' => function (WP_REST_Request $request) {
				$unchanged = webreview_check_expected_hash($request, 'css');
				if (is_wp_error($unchanged)) {
					return $unchanged;
				}
				$snapshot_id = webreview_create_snapshot('css', array(
					'post_id' => 0,
					'css' => (string) get_option(WEBREVIEW_CSS_OPTION, ''),
				), (string) ($request['summary'] ?: 'Site CSS'), (string) $request['request_id']);
				if (is_wp_error($snapshot_id)) {
					return $snapshot_id;
				}
				update_option(WEBREVIEW_CSS_OPTION, wp_strip_all_tags((string) $request['css']), false);
				webreview_mark_snapshot_applied($snapshot_id, 'css');
				return array('ok' => true, 'snapshot_id' => $snapshot_id);
			},
		),
	));

	// Change history.
	register_rest_route($ns, '/snapshots', array(
		'methods' => 'GET',
		'permission_callback' => 'webreview_permission',
		'callback' => function (WP_REST_Request $request) {
			$args = array('post_type' => WEBREVIEW_SNAPSHOT_TYPE, 'post_status' => 'private', 'posts_per_page' => 50, 'orderby' => 'ID', 'order' => 'DESC');
			if ($request['post_id']) {
				$args['meta_key'] = '_webreview_post_id';
				$args['meta_value'] = (int) $request['post_id'];
			}
			return array_map('webreview_snapshot_to_array', get_posts($args));
		},
	));

	// Undo a change: restore exactly what was there before it.
	register_rest_route($ns, '/snapshots/(?P<snapshot>\d+)/revert', array(
		'methods' => 'POST',
		'permission_callback' => 'webreview_permission',
		'callback' => function (WP_REST_Request $request) {
			$snapshot = get_post((int) $request['snapshot']);
			if (!$snapshot || $snapshot->post_type !== WEBREVIEW_SNAPSHOT_TYPE) {
				return new WP_Error('webreview_not_found', 'Change not found.', array('status' => 404));
			}
			$kind = get_post_meta($snapshot->ID, '_webreview_kind', true);
			$data = json_decode($snapshot->post_content, true);
			$post_id = isset($data['post_id']) ? (int) $data['post_id'] : 0;
			if ($post_id && !current_user_can('edit_post', $post_id)) {
				return new WP_Error('webreview_forbidden', 'This user cannot edit that page.', array('status' => 403));
			}
			if (get_post_meta($snapshot->ID, '_webreview_reverted', true)) {
				return new WP_Error('webreview_already_undone', 'This change was already undone.', array('status' => 409));
			}
			// Undo restores the whole page as it was; refuse if someone edited it after this change (unless forced)
			$after_hash = (string) get_post_meta($snapshot->ID, '_webreview_after_hash', true);
			if ($after_hash !== '' && empty($request['force']) && !hash_equals(webreview_target_hash($kind, $post_id), $after_hash)) {
				return new WP_Error('webreview_changed', 'The page was edited after this change, so undoing it would also remove those later edits.', array('status' => 409));
			}
			if ($kind === 'elementor') {
				update_post_meta($post_id, '_elementor_data', wp_slash($data['elementor_data']));
				webreview_clear_elementor_css($post_id);
			} elseif ($kind === 'content') {
				wp_update_post(array('ID' => $post_id, 'post_content' => wp_slash($data['content'])));
				if (webreview_page_builder($post_id) === 'divi') {
					webreview_clear_divi_cache($post_id);
				}
			} elseif ($kind === 'css') {
				update_option(WEBREVIEW_CSS_OPTION, $data['css'], false);
			} else {
				return new WP_Error('webreview_unknown_kind', 'Unknown change type.', array('status' => 400));
			}
			update_post_meta($snapshot->ID, '_webreview_reverted', 1);
			return array('ok' => true, 'reverted' => $snapshot->ID);
		},
	));
});

// ---------------------------------------------------------------------------------------------------------------------
// Settings page: choose which users may connect, show recent changes.
// ---------------------------------------------------------------------------------------------------------------------

add_action('admin_menu', function () {
	add_options_page('WebReview Connector', 'WebReview Connector', 'manage_options', 'webreview-connector', 'webreview_settings_page');
});

function webreview_settings_page() {
	if (!current_user_can('manage_options')) {
		return;
	}
	if (isset($_POST['webreview_save']) && check_admin_referer('webreview_settings')) {
		$ids = isset($_POST['webreview_allowed_users']) ? array_map('intval', (array) $_POST['webreview_allowed_users']) : array();
		update_option(WEBREVIEW_ALLOWED_USERS_OPTION, $ids, false);
		echo '<div class="notice notice-success"><p>Saved.</p></div>';
	}
	$allowed = array_map('intval', (array) get_option(WEBREVIEW_ALLOWED_USERS_OPTION, array()));
	$users = get_users(array('capability' => 'edit_pages'));
	$changes = get_posts(array('post_type' => WEBREVIEW_SNAPSHOT_TYPE, 'post_status' => 'private', 'posts_per_page' => 20, 'orderby' => 'ID', 'order' => 'DESC'));
	?>
	<div class="wrap">
		<h1>WebReview Connector</h1>
		<p>WebReview Pro uses this plugin to apply approved fixes. Every change is backed up first and can be undone.</p>
		<h2>Allowed users</h2>
		<p>Create a dedicated user (Editor role is enough), allow it here, then create an <strong>Application Password</strong> for it under <em>Users &gt; Profile</em> and paste it into WebReview Pro. Administrators are always allowed.</p>
		<form method="post">
			<?php wp_nonce_field('webreview_settings'); ?>
			<?php foreach ($users as $user) : ?>
				<label style="display:block;margin:4px 0">
					<input type="checkbox" name="webreview_allowed_users[]" value="<?php echo esc_attr($user->ID); ?>" <?php checked(in_array($user->ID, $allowed, true)); ?> />
					<?php echo esc_html($user->display_name . ' (' . $user->user_login . ')'); ?>
				</label>
			<?php endforeach; ?>
			<p><button class="button button-primary" name="webreview_save" value="1">Save</button></p>
		</form>
		<h2>Recent changes</h2>
		<?php if (!$changes) : ?>
			<p>No changes yet.</p>
		<?php else : ?>
			<table class="widefat striped"><thead><tr><th>When</th><th>Change</th><th>Page</th><th>Status</th></tr></thead><tbody>
			<?php foreach ($changes as $change) : $item = webreview_snapshot_to_array($change); ?>
				<tr>
					<td><?php echo esc_html(get_date_from_gmt(gmdate('Y-m-d H:i:s', strtotime($item['created'])), 'Y-m-d H:i')); ?></td>
					<td><?php echo esc_html($item['summary']); ?></td>
					<td><?php echo $item['post_id'] ? esc_html(get_the_title($item['post_id'])) : 'Site CSS'; ?></td>
					<td><?php echo $item['reverted'] ? 'Undone' : 'Applied'; ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody></table>
		<?php endif; ?>
	</div>
	<?php
}
