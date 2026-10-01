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
| `#/demo` | Opens the modality screen and starts the full-resolution MRI run immediately |

`#autorun` jumps straight to the parallel-beam dashboard.

## Run

```bash
npm install
npm run dev      # http://localhost:3100
npm run build    # static bundle in dist/ — serve from any static host, no backend
```

## Full-resolution MRI engine (Phase 0)

`src/lib/mri/` verifies Cartesian multi-coil MRI from **raw k-space** at clinical matrix size,
entirely in the browser (web worker):

- **Inputs:** fastMRI multicoil/singlecoil `.h5` and ISMRMRD `.h5` (via `h5wasm`, read
  as raw hyperslabs), or a built-in simulated 8-channel acquisition.
- **Operator:** SENSE with coil sensitivities estimated from the calibration lines. With
  equispaced undersampling the normal operator is block diagonal over aliasing sets, so
  every R×R block is **eigen-decomposed exactly**. Bands are orthogonal projections by
  noise amplification: measured g ≤ 1.4, ill-conditioned 1.4–5, null g > 5. Band energies
  sum to 100%.
- **χ² test:** residuals evaluated exactly from the block spectra, with a thermal noise
  estimate (image background or object-free readout rows) and a floor calibrated on the
  data-consistent fit, so sensitivity-model error isn't counted as inconsistency.
- **Scenarios:** (1) a prior-filled reconstruction (data-consistent SENSE plus a TV prior in
  the null band); (2) a **hallucinated lesion** confined to the null band and scaled to the
  largest amplitude that keeps Δχ² within 1σ, so it passes χ² but is flagged red; (3) the
  same lesion added naively, which χ² rejects.
- **Limits:** equispaced Cartesian masks only (random masks are reported as unsupported),
  diagonal noise model (no coil prewhitening yet), magnitude AI reconstructions from
  vendors not yet ingested.

Fully-sampled files are retrospectively undersampled at the chosen R (4 or 8); undersampled
files use their own mask and calibration region.

```bash
npm test            # FFT, engine and undersampled-data tests (Node, no browser)
npm run test:io     # generates fastMRI + ISMRMRD fixtures (needs numpy, h5py, ismrmrd) and tests both loaders
npm run build:demo  # dist-demo/index.html: one self-contained file, no HDF5 reader
```

`outreach/` holds the USZ email (HTML and plain text) and a preview image.

## Reference engine

`src/lib/engine.ts` looks for the compiled Rust→WASM package at build time:

- `../wasm/pkg/nullspace_recon_wasm.js` (the `demo/wasm/pkg` layout of the main repo), or
- `./wasm-pkg/nullspace_recon_wasm.js` (copy the `pkg/` output here).

If found, a **Demo data / Live WASM** toggle appears on the modality screen (or open the
app with `?live` to start in live mode), and `verify_parallel_beam`, `verify_fan_beam` and
`verify_mri` run in the browser. The default is always the curated **reference dataset**: a Shepp-Logan phantom,
a degraded reconstruction, a spectral band split, and the published verification
statistics (parallel-beam at TV λ=0.1 reproduces the reference values exactly:
rel. error 431.5 %, rank 869, p = 0.5113, χ²ᵣ = 0.997). Manifest hashes are real SHA-256
digests of the arrays shown. The engine in use is shown on the modality screen and
recorded in the manifest's `engine` field.

Everything runs client-side; the only network request is for Google Fonts.
