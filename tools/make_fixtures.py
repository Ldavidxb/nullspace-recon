"""Generate simulated multi-coil MRI raw-data files for testing the loaders.

Writes two files with the same simulated acquisition (fully sampled, centred k-space,
2x readout oversampling like the fastMRI brain/knee multicoil data):

  fixtures/sim_fastmri_multicoil.h5   fastMRI layout: kspace (slices, coils, ro, pe), reconstruction_rss
  fixtures/sim_ismrmrd.h5             ISMRMRD layout: /dataset/data acquisitions + /dataset/xml header

Usage: python3 tools/make_fixtures.py [outdir]   (needs numpy, h5py, ismrmrd)
"""
import os
import sys

import h5py
import numpy as np

RO, PE, COILS, SLICES = 640, 368, 8, 2
rng = np.random.default_rng(7)

# Modified Shepp-Logan, [A, a, b, x0, y0, phi]
ELLIPSES = [
    [1.0, 0.69, 0.92, 0, 0, 0], [-0.8, 0.6624, 0.874, 0, -0.0184, 0],
    [-0.2, 0.11, 0.31, 0.22, 0, -18], [-0.2, 0.16, 0.41, -0.22, 0, 18],
    [0.1, 0.21, 0.25, 0, 0.35, 0], [0.1, 0.046, 0.046, 0, 0.1, 0],
    [0.1, 0.046, 0.046, 0, -0.1, 0], [0.1, 0.046, 0.023, -0.08, -0.605, 0],
    [0.1, 0.023, 0.023, 0, -0.606, 0], [0.1, 0.023, 0.046, 0.06, -0.605, 0],
]


def phantom(n):
    y, x = np.mgrid[1:-1:n * 1j, -1:1:n * 1j]
    img = np.zeros((n, n))
    for A, a, b, x0, y0, phi in ELLIPSES:
        t = np.deg2rad(phi)
        xr = (x - x0) * np.cos(t) + (y - y0) * np.sin(t)
        yr = -(x - x0) * np.sin(t) + (y - y0) * np.cos(t)
        img[(xr / a) ** 2 + (yr / b) ** 2 <= 1] += A
    return img


def coil_maps(ro, pe, n):
    y, x = np.mgrid[0:ro, 0:pe]
    cy, cx = ro / 2, pe / 2
    maps = []
    for c in range(n):
        ang = 2 * np.pi * c / n
        py, px = cy + 0.7 * 160 * np.sin(ang), cx + 0.7 * 160 * np.cos(ang)
        d2 = ((y - py) ** 2 + (x - px) ** 2) / (150.0 ** 2)
        mag = np.exp(-d2)
        ph = 0.6 * np.pi * ((y - cy) * np.sin(ang) + (x - cx) * np.cos(ang)) / 320
        maps.append(mag * np.exp(1j * ph))
    maps = np.array(maps)
    return maps / np.sqrt((np.abs(maps) ** 2).sum(0)).max()


def fft2c(x):
    return np.fft.fftshift(np.fft.fft2(np.fft.ifftshift(x, axes=(-2, -1)), norm="ortho"), axes=(-2, -1))


def ifft2c(k):
    return np.fft.fftshift(np.fft.ifft2(np.fft.ifftshift(k, axes=(-2, -1)), norm="ortho"), axes=(-2, -1))


def simulate():
    sens = coil_maps(RO, PE, COILS)
    kspace = np.zeros((SLICES, COILS, RO, PE), np.complex64)
    rss = np.zeros((SLICES, 320, 320), np.float32)
    y, x = np.mgrid[0:RO, 0:PE]
    for s in range(SLICES):
        img = np.zeros((RO, PE), complex)
        p = phantom(320) * (1.0 - 0.15 * s)
        img[RO // 2 - 160:RO // 2 + 160, PE // 2 - 160:PE // 2 + 160] = p
        img = img * np.exp(1j * 0.4 * np.pi * (x - PE / 2) / PE)  # smooth background phase
        k = fft2c(sens * img[None])
        k += 0.004 * (rng.standard_normal(k.shape) + 1j * rng.standard_normal(k.shape))
        kspace[s] = k.astype(np.complex64)
        coil_imgs = ifft2c(k)
        r = np.sqrt((np.abs(coil_imgs) ** 2).sum(0))
        rss[s] = r[RO // 2 - 160:RO // 2 + 160, PE // 2 - 160:PE // 2 + 160]
    return kspace, rss


def write_fastmri(path, kspace, rss):
    with h5py.File(path, "w") as f:
        f.create_dataset("kspace", data=kspace)
        f.create_dataset("reconstruction_rss", data=rss)
        f.attrs["acquisition"] = "SIM_PHANTOM"
        f.attrs["max"] = float(rss.max())
        f.attrs["norm"] = float(np.linalg.norm(rss))
        f.attrs["patient_id"] = "simulated"


def write_ismrmrd(path, kspace):
    import ismrmrd

    if os.path.exists(path):
        os.remove(path)
    dset = ismrmrd.Dataset(path, "/dataset", True)
    xml = f"""<?xml version="1.0" encoding="utf-8"?>
<ismrmrdHeader xmlns="http://www.ismrm.org/ISMRMRD">
  <experimentalConditions><H1resonanceFrequency_Hz>123000000</H1resonanceFrequency_Hz></experimentalConditions>
  <acquisitionSystemInformation><receiverChannels>{COILS}</receiverChannels></acquisitionSystemInformation>
  <encoding>
    <encodedSpace><matrixSize><x>{RO}</x><y>{PE}</y><z>1</z></matrixSize>
      <fieldOfView_mm><x>440</x><y>220</y><z>5</z></fieldOfView_mm></encodedSpace>
    <reconSpace><matrixSize><x>320</x><y>320</y><z>1</z></matrixSize>
      <fieldOfView_mm><x>220</x><y>220</y><z>5</z></fieldOfView_mm></reconSpace>
    <encodingLimits>
      <kspace_encoding_step_1><minimum>0</minimum><maximum>{PE - 1}</maximum><center>{PE // 2}</center></kspace_encoding_step_1>
      <slice><minimum>0</minimum><maximum>{SLICES - 1}</maximum><center>0</center></slice>
    </encodingLimits>
    <trajectory>cartesian</trajectory>
  </encoding>
</ismrmrdHeader>"""
    dset.write_xml_header(xml)

    for s in range(SLICES):
        for line in range(PE):
            acq = ismrmrd.Acquisition.from_array(np.ascontiguousarray(kspace[s, :, :, line]))
            acq.idx.kspace_encode_step_1 = line
            acq.idx.slice = s
            acq.center_sample = RO // 2
            dset.append_acquisition(acq)
    dset.close()


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "fixtures"
    os.makedirs(out, exist_ok=True)
    k, r = simulate()
    write_fastmri(os.path.join(out, "sim_fastmri_multicoil.h5"), k, r)
    write_ismrmrd(os.path.join(out, "sim_ismrmrd.h5"), k)
    print("wrote", out)
