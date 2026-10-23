// Original schematic, based on ESA's Gaia factsheet and spacecraft illustrations.
// This is an educational illustration, not an engineering reconstruction.
// Reference: https://www.esa.int/Science_Exploration/Space_Science/Gaia/Gaia_factsheet
const fs = require('node:fs/promises');
const path = require('node:path');
const THREE = require('../my-app/node_modules/three');

global.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};

async function main() {
  const { GLTFExporter } = await import('../my-app/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const scene = new THREE.Scene();
  const gold = new THREE.MeshStandardMaterial({ color: '#c5a867', metalness: 0.7, roughness: 0.4 });
  const foil = new THREE.MeshStandardMaterial({ color: '#c8c5bb', metalness: 0.65, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#0c1830', metalness: 0.3, roughness: 0.3 });
  const mesh = (geometry, material, position = [0, 0, 0]) => {
    const object = new THREE.Mesh(geometry, material); object.position.set(...position); scene.add(object); return object;
  };
  mesh(new THREE.CylinderGeometry(5, 5, 0.07, 12), foil);
  mesh(new THREE.CylinderGeometry(4.92, 4.92, 0.015, 12), dark, [0, -0.045, 0]);
  mesh(new THREE.CylinderGeometry(1.2, 1.25, 0.7, 12), gold, [0, 0.4, 0]);
  mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.9, 24), foil, [0, 1.7, 0]);
  mesh(new THREE.CylinderGeometry(1.17, 1.17, 0.08, 24), gold, [0, 2.69, 0]);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const rib = mesh(new THREE.BoxGeometry(4.95, 0.025, 0.035), gold, [2.475 * Math.cos(angle), 0.06, 2.475 * Math.sin(angle)]);
    rib.rotation.y = -angle;
  }
  for (const angle of [0, THREE.MathUtils.degToRad(106.5)]) {
    const aperture = mesh(new THREE.BoxGeometry(0.72, 0.42, 0.08), dark, [Math.sin(angle) * 1.16, 2.18, Math.cos(angle) * 1.16]);
    aperture.rotation.y = angle;
  }
  scene.userData = { author: 'OrbitLight', description: 'Schematic Gaia spacecraft based on ESA reference material. Simplified shapes and proportions.' };
  const buffer = await new GLTFExporter().parseAsync(scene, { binary: true });
  const destination = path.resolve(__dirname, '../my-app/public/gaia/models/gaia.glb');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from(buffer));
  console.log(`Gaia schematic: ${buffer.byteLength} bytes`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
