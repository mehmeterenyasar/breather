# Store listings

The copy in this folder goes straight into the submission forms.

| File                                                                            | Contents                                                                                      |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [chrome-en.md](chrome-en.md) / [chrome-tr.md](chrome-tr.md)                     | Chrome Web Store: name, short description (≤132 characters), long description, privacy fields |
| [edge-en.md](edge-en.md) / [edge-tr.md](edge-tr.md)                             | Edge Add-ons: the Edge-specific fields on top of the Chrome copy                              |
| [permissions-en.md](permissions-en.md) / [permissions-tr.md](permissions-tr.md) | A justification per permission, ready to paste into the review form                           |
| [screenshots.md](screenshots.md)                                                | The five screenshots to take, and how to prepare them at 1280 × 800                           |

The privacy policy is one folder up: [`PRIVACY.md`](../PRIVACY.md), English and
Turkish.

---

## Building the packages

```bash
npm run check
```

```bash
npm run zip
```

| File                                 | Goes to                         |
| ------------------------------------ | ------------------------------- |
| `.output/breather-1.1.0-chrome.zip`  | Chrome Web Store                |
| `.output/breather-1.1.0-edge.zip`    | Microsoft Edge Add-ons          |
| `.output/breather-1.1.0-firefox.zip` | addons.mozilla.org              |
| `.output/breather-1.1.0-sources.zip` | the source archive AMO asks for |

AMO wants the source for any add-on submitted as a built package, and WXT
produces that archive itself. The review note only needs to say:

```
Build: Node 22.12+, "npm ci" then "npm run build:firefox".
Output is in .output/firefox-mv3. Build tool: WXT (Vite).
```

---

## Before submitting

### Identity and copy

- [ ] `geckoId` in `src/brand.ts` replaced with your own domain (the placeholder
      is `breather@breather.app`)
- [ ] Privacy policy published at a URL and entered in both store forms
- [ ] Every "fill in before release" note in `PRIVACY.md` and `store/*` resolved
- [ ] Product name final (if it changes: `extName` in `src/locales/*.ts` and the
      copy in `store/`; it appears nowhere else in the code)

### Technical

- [ ] `npm run check` clean
- [ ] Manual smoke test done in all three browsers (the list in the README)
- [ ] Version bumped in `package.json` and `CHANGELOG.md` written
- [ ] The developer section is absent from a production build
      (`grep -r seedFakeData .output/chrome-mv3` returns nothing)
- [ ] No console errors in the popup, settings, break window or service worker

### Store forms

- [ ] Screenshots taken (see `screenshots.md`), with no personal data in them
- [ ] Justification pasted for each permission
- [ ] Single purpose description entered
- [ ] Remote code question: **No**
- [ ] Data collection questions: **No** throughout
