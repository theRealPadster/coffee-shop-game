# Contributing

Thanks for your interest in Coffee Shop Game! Issues and pull requests are welcome.

For anything bigger than a small fix or tweak, please **open an issue first** so we can chat about the approach before you spend time on it.

## License of contributions

By submitting a pull request, you agree that your contributions are licensed under the [GNU Affero General Public License v3.0](LICENSE) — the same license that covers the rest of the project.

## Local setup

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # type-check + build the single-file bundle into dist/
```

There are no tests; a clean `npm run build` (which runs `tsc --noEmit` first) is the verification step.
