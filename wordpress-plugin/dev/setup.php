<?php
/**
 * Local test site setup (WordPress Playground). Safe to run on every start: only creates what is missing.
 * Writes the test agent's Application Password to wp-content/webreview-test-credentials.json (local test only).
 */

// Run as the site administrator (Elementor checks permissions when site settings change)
wp_set_current_user(1);

if (get_option('blogname') !== 'WebReview Test Site') {
	update_option('blogname', 'WebReview Test Site');
}
if (get_option('permalink_structure') !== '/%postname%/') {
	update_option('permalink_structure', '/%postname%/');
	flush_rewrite_rules();
}

// Dedicated agent user (Editor role), allowed in WebReview Connector
$agent = get_user_by('login', 'webreview-agent');
if (!$agent) {
	$agent_id = wp_insert_user(array(
		'user_login' => 'webreview-agent',
		'user_pass' => wp_generate_password(32),
		'user_email' => 'webreview-agent@example.test',
		'display_name' => 'WebReview Agent',
		'role' => 'editor',
	));
	$agent = get_user_by('id', $agent_id);
}
$allowed = array_map('intval', (array) get_option('webreview_allowed_users', array()));
if (!in_array($agent->ID, $allowed, true)) {
	$allowed[] = $agent->ID;
	update_option('webreview_allowed_users', $allowed, false);
}

// Application Password for the agent (created once; the plain password is only shown at creation)
$credentials_file = WP_CONTENT_DIR . '/webreview-test-credentials.json';
if (!file_exists($credentials_file) && class_exists('WP_Application_Passwords')) {
	$created = WP_Application_Passwords::create_new_application_password($agent->ID, array('name' => 'WebReview Pro (local test)'));
	if (!is_wp_error($created)) {
		file_put_contents($credentials_file, wp_json_encode(array(
			'site_url' => home_url('/'),
			'username' => 'webreview-agent',
			'application_password' => $created[0],
		), JSON_PRETTY_PRINT));
	}
}

// Gutenberg sample page, used as the home page
$home = get_page_by_path('home');
if (!$home) {
	$home_id = wp_insert_post(array(
		'post_type' => 'page',
		'post_status' => 'publish',
		'post_title' => 'Home',
		'post_name' => 'home',
		'post_content' => implode("\n\n", array(
			'<!-- wp:heading {"level":1} --><h1 class="wp-block-heading">Reliable electrical service</h1><!-- /wp:heading -->',
			'<!-- wp:paragraph --><p>We fix wiring, panels and lighting for homes and businesses across the city.</p><!-- /wp:paragraph -->',
			'<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#contact">Request service</a></div><!-- /wp:button --></div><!-- /wp:buttons -->',
		)),
	));
	update_option('show_on_front', 'page');
	update_option('page_on_front', $home_id);
}

// Elementor sample page
if (defined('ELEMENTOR_VERSION') && !get_page_by_path('elementor-sample')) {
	$elementor_data = array(array(
		'id' => 'c0a1b2c',
		'elType' => 'container',
		'isInner' => false,
		'settings' => array('content_width' => 'boxed', 'flex_direction' => 'column'),
		'elements' => array(
			array('id' => 'h1e2a3d', 'elType' => 'widget', 'widgetType' => 'heading', 'elements' => array(),
				'settings' => array('title' => 'Elementor sample heading', 'header_size' => 'h1', 'title_color' => '#1E293B')),
			array('id' => 't1x2t3e', 'elType' => 'widget', 'widgetType' => 'text-editor', 'elements' => array(),
				'settings' => array('editor' => '<p>This page is built with Elementor so the WebReview agent can be tested on it.</p>')),
			array('id' => 'b1t2n3x', 'elType' => 'widget', 'widgetType' => 'button', 'elements' => array(),
				'settings' => array('text' => 'Request service', 'link' => array('url' => '#contact'), 'background_color' => '#2563EB')),
		),
	));
	$page_id = wp_insert_post(array(
		'post_type' => 'page',
		'post_status' => 'publish',
		'post_title' => 'Elementor Sample',
		'post_name' => 'elementor-sample',
		'post_content' => '',
	));
	update_post_meta($page_id, '_elementor_edit_mode', 'builder');
	update_post_meta($page_id, '_elementor_template_type', 'wp-page');
	update_post_meta($page_id, '_elementor_version', ELEMENTOR_VERSION);
	update_post_meta($page_id, '_elementor_data', wp_slash(wp_json_encode($elementor_data)));
}
