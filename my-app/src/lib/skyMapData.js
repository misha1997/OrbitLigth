// Share parsed static catalogs between the inline map and fullscreen sessions.
const catalogs = new Map();

export function loadSkyCatalog(url) {
  if (!catalogs.has(url)) {
    const request = fetch(url).then(response => {
      if (!response.ok) throw new Error(`Sky catalog: HTTP ${response.status}`);
      return response.json();
    }).catch(error => {
      catalogs.delete(url); // Allow retry after a transient failure.
      throw error;
    });
    catalogs.set(url, request);
  }
  return catalogs.get(url);
}

// Query only cells intersecting the viewport, even in the 113k-star catalog.
export function indexSkyPoints(points, cellSize = 64) {
  const cells = new Map();
  for (const point of points) {
    const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(point);
  }
  return { cells, cellSize };
}

export function querySkyPoints({ cells, cellSize }, bounds) {
  const result = [];
  for (let x = Math.floor(bounds.left / cellSize); x <= Math.floor(bounds.right / cellSize); x++) {
    for (let y = Math.floor(bounds.top / cellSize); y <= Math.floor(bounds.bottom / cellSize); y++) {
      for (const point of cells.get(`${x},${y}`) || []) {
        if (point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom) {
          result.push(point);
        }
      }
    }
  }
  return result;
}

export const SKY_MAGNITUDES = [5, 6.5, 7.5, 8.5, 10.5];

// Separate magnitude bins also avoid scanning faint stars at low zoom.
export function indexSkyStars(points) {
  const bins = SKY_MAGNITUDES.map(() => []);
  for (const point of points) {
    const bin = SKY_MAGNITUDES.findIndex(limit => point.star[3] <= limit);
    if (bin >= 0) bins[bin].push(point);
  }
  return bins.map(bin => indexSkyPoints(bin));
}

export function querySkyStars(index, bounds, magnitude) {
  const result = [];
  SKY_MAGNITUDES.forEach((limit, bin) => {
    if (limit <= magnitude) result.push(...querySkyPoints(index[bin], bounds));
  });
  return result;
}
