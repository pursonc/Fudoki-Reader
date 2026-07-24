# Fudoki Reader Privacy Policy

Effective date: July 24, 2026

Fudoki Reader helps users read Japanese text on webpages. This policy explains
how the extension handles data.

## Data Handled by the Extension

### Webpage Text

Fudoki Reader reads Japanese text from the webpage the user is viewing to add
readings, part-of-speech information, selection controls, and other reading
assistance. Japanese text analysis is performed locally in the browser with
libraries bundled in the extension. The developer does not receive this locally
processed text.

### Optional Translation

Translation is optional and is initiated by the user. When the user requests a
translation, the selected Japanese text or sentence is sent over HTTPS to
Google's translation service at `translate.googleapis.com`. The service returns
the translated result to the extension. Fudoki Reader does not operate a
translation server and does not retain the transmitted text.

### Local Storage

The extension uses Chrome local storage for:

- Interface, reading, translation, theme, and speech settings
- Vocabulary items explicitly saved by the user
- Saved context, translations, and spaced-repetition review progress
- A local notice when the extension has been updated

This information remains in the user's browser and is not sent to the
developer. Users can delete it by removing saved vocabulary, clearing the
extension's storage, or uninstalling the extension.

## External Services

Fudoki Reader can open the following external services only after the user
chooses the corresponding action:

- Google Forms for optional feedback
- Wise for optional financial support

Information entered on those external websites is handled by the respective
service under its own privacy policy. Fudoki Reader does not receive payment
card or bank account information.

The extension does not include analytics or advertising code. Google may
provide the developer with aggregated, non-user-level metrics for the Chrome
Web Store listing under Google's own policies.

## Data Sharing and Sale

Fudoki Reader does not sell user data. It does not use or transfer user data for
advertising, creditworthiness, lending, or purposes unrelated to its
user-facing Japanese reading features. Webpage text is transferred only when
necessary to provide a translation explicitly requested by the user.

The use of information received through Chrome APIs complies with the Chrome
Web Store User Data Policy, including the Limited Use requirements.

## Permissions

- `storage`: Saves settings and user-created vocabulary data locally.
- `offscreen`: Runs the bundled Japanese tokenizer in a local document context.
- Webpage access: Adds reading assistance to webpages the user visits.
- `translate.googleapis.com`: Provides optional user-requested translations.

## Changes

Material changes to this policy will be published on this page and reflected in
the effective date above.

## Contact

Questions or privacy requests can be submitted through the
[Fudoki Reader feedback form](https://docs.google.com/forms/d/e/1FAIpQLSfjJZ7TOevSTNbtfk0PuBCpK8W3eO-YvWnMvXu4l5-b2TeUTQ/viewform?usp=dialog).
