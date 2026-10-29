# Vpin for Chrome

Shows your Vpin notifications and open pins in the toolbar, with a desktop alert for new client feedback.

- **Badge:** unread notifications.
- **Popup:** *Notifications* and *My open pins*. Your pins are the ones assigned to you, or unassigned pins on projects assigned to you. Clicking an item opens the exact pin.
- **Desktop alerts:** Vpin is checked every minute while Chrome is running.

## Install (testing)

1. Open `chrome://extensions` and switch on **Developer mode**.
2. Click **Load unpacked** and choose this `chrome-extension` folder.
3. Click the Vpin icon, then **Connect**, and approve in the Vpin tab that opens.

To share a copy, run `npm run ext:zip`. It creates `build/vpin-chrome-extension.zip`, which teammates unzip and load the same way.

## Live

- When Vpin is hosted, open the extension's **Options** (right-click the icon → Options) and enter the live address, then connect again.
- For the whole team, publish it as a **private** item on the Chrome Web Store (visible only to your Google Workspace domain). Your Workspace admin can also install it for everyone.

## How connecting works

The extension never sees your password. In Vpin you approve it, and it gets its own access key. **Disconnect** in the popup removes the key, and keys stop working when a member is removed from the team.
