# Privacy Policy — Torva Smart Light

**Last updated:** June 2026

Torva Smart Light ("App") is a mobile application that lets you control your ESP32-based smart LED devices over your local Wi-Fi network. This document explains what data the App processes and how.

## Core Principle

Torva Smart Light does not send any data to remote servers. All device information, settings, and preferences are stored exclusively on your phone's local storage. The App communicates with your ESP32 devices directly and only over your local network (your home Wi-Fi).

## Data We Collect and Process

**Device information (local storage):** The name, IP address, PIN (if set), and color/brightness preferences of ESP32 devices you add are stored on your phone (AsyncStorage). This information is never transmitted to any server.

**Language preference:** Your chosen app language (Turkish/English) is stored locally.

**Automation rules:** Timer and automation rules you create are stored both on your phone and in the memory of the relevant ESP32 device.

## Permissions and Why We Need Them

**Local network access:** Required to discover your ESP32 devices on your network and communicate with them.

**Location permission (Android only):** Android requires location permission to perform Wi-Fi network scans. The App does not record or use your location for any other purpose; this permission is solely a technical requirement imposed by Android.

**Notifications:** Used to remind you of your scheduled timer/automation rules. All notifications are planned locally on your device.

## Sharing Data with Third Parties

The App does not share, sell, or use any user data for advertising purposes with any third party. There are no ads in the App.

## Firmware Updates (OTA)

When checking for a firmware update, the App accesses a publicly hosted file on GitHub to retrieve the latest version information. No personal data is sent during this request.

## Deleting Your Data

When you remove a device from the list or uninstall the App, all related data stored on your phone is deleted. You can also wipe all data on the ESP32 device itself by performing a factory reset.

## Contact

If you have questions about this privacy policy, you can reach us via the contact information provided in the App Store listing.

## Changes

If this policy is updated, the date of the change will be reflected in the "Last updated" field above.
