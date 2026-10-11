# Permission justifications — English

Store reviews ask for a separate justification per permission. The texts below can
be pasted straight into the form.

---

## `storage`

```
Required to save the user's settings (session lengths, break preferences, theme, sound) and the state of a running timer. Timer state is kept in local storage so that a session continues with the correct remaining time even after the browser is closed and reopened. No data ever leaves the device.
```

## `alarms`

```
Required to schedule the end of focus sessions and breaks. In Manifest V3 the service worker can be suspended at any moment, so setTimeout/setInterval are not reliable; end times are set as absolute timestamps with chrome.alarms. Without alarms the timer cannot run while the browser is in the background.
```

## `notifications`

```
Required to tell the user when a focus session or a break has ended. Notifications are core to the extension: if the user is on another tab, there is no other way for them to learn that the timer finished.
```

## `idle`

```
Required to pause the stopwatch and reset health-break counters when the user steps away from the computer or the screen locks. Time spent away from the screen should not count as work, and the user has effectively already taken a break. Only the "idle / active / locked" state is read; no other information is obtained.
```

## `offscreen` (Chrome and Edge only)

```
Required to play a short notification tone when a session or break ends. The Web Audio API is not available in a service worker, so the tone is generated in a temporary offscreen document that is opened only while the tone plays and closed immediately afterwards. The package contains no audio files; the tone is synthesised with Web Audio. The document is never kept open.
```

## `tabs` (optional — only if the user asks for it)

```
Requested at runtime only when the user turns on "meeting detection" by clicking the switch on the settings page. While the feature is off, the permission is never requested and no tab is ever queried.

When it is on, only the ACTIVE tab's address is read and compared against a user-editable list of meeting domains (default: meet.google.com, zoom.us, teams.microsoft.com, teams.live.com). On a match, reminders are temporarily silenced.

The address is never written down, stored or transmitted; it is only compared in memory. When the user turns the feature off, the permission is revoked from the browser.
```

---

## Host permissions and content scripts

The extension has **no host permissions** and injects no content script into any
page. The break screen is not overlaid on the page you are visiting; it opens as
the extension's own window.

## Remote code

No remote code is executed. All scripts, styles and the typeface are bundled
inside the package. The extension makes no network requests.
