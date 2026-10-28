// Reproducible NASA/ESA asset mirrors for mission pages.
// Credits and original source pages are kept in src/lib/missionDetails.js.
const fs = require('node:fs/promises');
const path = require('node:path');

const assets = [
  ['pioneer10/models/pioneer10.glb', 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Pioneer%2010/Pioneer%2010.glb'],
  // Pioneer 11 shares the basic spacecraft design; the page labels this as a Pioneer 10 model.
  ['pioneer11/models/pioneer11.glb', 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Pioneer%2010/Pioneer%2010.glb'],
  ['pioneer10/images/launch.jpg', 'https://www.nasa.gov/wp-content/uploads/2022/03/pioneer_10_launch_2.jpg'],
  ['pioneer10/images/jupiter.jpg', 'https://www.nasa.gov/wp-content/uploads/2022/03/pioneer_10_launch_7_jupiter_europa_ganymede_composite.jpg'],
  ['pioneer10/images/plaque.jpg', 'https://www.nasa.gov/wp-content/uploads/2022/03/pioneer_10_launch_9_plaque.jpg'],
  ['pioneer11/images/saturn.jpg', 'https://www.nasa.gov/wp-content/uploads/2019/08/saturn_from_pioneer_11.jpg'],
  ['pioneer11/images/jupiter.jpg', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/internal_resources/2551/Fuzzy_color_image_of_Jupiter.jpeg'],
  ['pioneer11/images/trajectory.jpg', 'https://www.nasa.gov/wp-content/uploads/2019/08/pioneer_11_trajectory.jpg'],
  ['spitzer/models/spitzer.glb', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/s/SPITZER.glb'],
  ['spitzer/images/helix.jpg', 'https://images-assets.nasa.gov/image/PIA09178/PIA09178~medium.jpg'],
  ['spitzer/images/orion.jpg', 'https://images-assets.nasa.gov/image/PIA13959/PIA13959~medium.jpg'],
  ['spitzer/images/trappist.jpg', 'https://images-assets.nasa.gov/image/PIA21422/PIA21422~medium.jpg'],
  ['kepler/models/kepler.glb', 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Kepler%20(A)/Kepler%20(A).glb'],
  ['kepler/images/fields.jpg', 'https://images-assets.nasa.gov/image/ACD20-0045-002/ACD20-0045-002~medium.jpg'],
  ['kepler/images/kepler186f.jpg', 'https://images-assets.nasa.gov/image/PIA17999/PIA17999~medium.jpg'],
  ['kepler/images/kepler16b.jpg', 'https://images-assets.nasa.gov/image/PIA14724/PIA14724~medium.jpg'],
  ['osirisrex/models/osirisrex.glb', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/o/Osiris_Rex.glb'],
  ['osirisrex/images/bennu.png', 'https://www.nasa.gov/wp-content/uploads/2023/03/twelve-image_polycam_mosaic_12-2-18.png'],
  ['osirisrex/images/return.jpg', 'https://images-assets.nasa.gov/image/NHQ202309240006/NHQ202309240006~medium.jpg'],
  ['osirisrex/images/samples.jpg', 'https://images-assets.nasa.gov/image/jsc2024e023024/jsc2024e023024~medium.jpg'],
  ['gaia/images/observing.jpg', 'https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2022/06/gaia_observes_the_milky_way/24305944-1-eng-GB/Gaia_observes_the_Milky_Way_pillars.jpg'],
  ['gaia/images/milkyway.jpg', 'https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2022/06/gaia_exploring_the_multi-dimensional_milky_way/24305477-1-eng-GB/Gaia_Exploring_the_multi-dimensional_Milky_Way_pillars.jpg'],
  ['gaia/images/asteroids.jpg', 'https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2022/06/gaia_solar_system_observations/24090464-1-eng-GB/Gaia_Solar_System_observations_pillars.jpg'],
  ['perseverance/models/perseverance.glb', 'https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/25042_Perseverance.glb'],
  ['cassini/models/cassini.glb', 'https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/c/Cassini.glb'],
  ['perseverance/images/selfie.jpg', 'https://images-assets.nasa.gov/image/PIA24542/PIA24542~medium.jpg'],
  ['perseverance/images/kodiak.jpg', 'https://images-assets.nasa.gov/image/PIA24802/PIA24802~medium.jpg'],
  ['perseverance/images/depot.jpg', 'https://images-assets.nasa.gov/image/PIA25678/PIA25678~medium.jpg'],
  ['cassini/images/saturn.jpg', 'https://images-assets.nasa.gov/image/PIA17172/PIA17172~medium.jpg'],
  ['cassini/images/enceladus.jpg', 'https://images-assets.nasa.gov/image/PIA07758/PIA07758~small.jpg'],
  ['cassini/images/titan.jpg', 'https://images-assets.nasa.gov/image/PIA20016/PIA20016~medium.jpg'],
];

async function main() {
  for (const [file, url] of assets) {
    if (process.argv.length > 2 && !process.argv.slice(2).includes(file.split('/')[0])) continue;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const glb = file.endsWith('.glb');
    const valid = glb ? buffer.toString('ascii', 0, 4) === 'glTF'
      : file.endsWith('.png') ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : buffer[0] === 0xff && buffer[1] === 0xd8;
    if (!valid) {
      throw new Error(`Unexpected asset format: ${url}`);
    }
    const destination = path.join(__dirname, '../my-app/public', file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, buffer);
    console.log(`${file}: ${buffer.length} bytes`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
