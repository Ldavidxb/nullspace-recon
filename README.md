# nullspace-recon — Medical Image Verification Demo

Sales demo frontend for **nullspace-recon**, a physics-based verification engine for
AI-reconstructed medical images. It decomposes every pixel of a reconstruction into
three provenance bands — **measured**, **ill-conditioned** and **null-space (AI-supplied)** —
runs a χ² residual test, and produces a SHA-256 manifest ready for ML-DSA-65 signing.

## Screens

| Route | Screen |
|---|---|
| `#/` | Landing / hero |
| `#/verify` | Modality selection (Parallel-beam CT, Fan-beam CT, MRI) + prior / λ |
| `#/dashboard` | Verification dashboard: stats, ground truth / reconstruction / provenance heatmap, χ² gauge, spectral radar |
| `#/manifest` | Verification manifest (syntax-highlighted JSON, copy, download) |

`#autorun` jumps straight to the parallel-beam dashboard.

## Run

```bash
npm install
npm run dev      # http://localhost:3100
npm run build    # static bundle in dist/ — serve from any static host, no backend
```

## Engine

`src/lib/engine.ts` looks for the compiled Rust→WASM package at build time:

- `../wasm/pkg/nullspace_recon_wasm.js` (the `demo/wasm/pkg` layout of the main repo), or
- `./wasm-pkg/nullspace_recon_wasm.js` (copy the `pkg/` output here).

If found, `verify_parallel_beam`, `verify_fan_beam` and `verify_mri` run live in the
browser. If not, a deterministic **reference dataset** is used: a Shepp-Logan phantom,
a degraded reconstruction, a spectral band split, and the published verification
statistics (parallel-beam at TV λ=0.1 reproduces the reference values exactly:
rel. error 431.5 %, rank 869, p = 0.5113, χ²ᵣ = 0.997). Manifest hashes are real SHA-256
digests of the arrays shown. The engine in use is shown on the modality screen and
recorded in the manifest's `engine` field.

Everything runs client-side; the only network request is for Google Fonts.
