// src/lib/viewerHtml.ts
// Builds the HTML page the WebView shows. 3Dmol.js does all the 3D work inside the WebView.
// ligand/chain may be "" (e.g. AlphaFold predictions): then the whole model is shown as a cartoon
// with no ligand, pocket or halo styling.
export function buildViewerHtml(fileUrl: string, ligand: string, chain: string) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin:0; height:100%; background:#0b1020; overflow:hidden; -webkit-user-select:none; }
  #viewer { width:100%; height:100%; position:relative; }
  #status { position:absolute; top:10px; left:10px; color:#cfd8ff; font:14px -apple-system, sans-serif;
            z-index:5; pointer-events:none; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.5.5/3Dmol-min.js"></script>
</head>
<body>
<div id="viewer"></div>
<div id="status">Loading structure…</div>
<script>
(function () {
  var status = document.getElementById('status');
  var send = function (m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(m); };
  window.onerror = function (m) { status.textContent = 'JS error: ' + m; send('error:' + m); };

  var HAS_LIG = ${ligand ? "true" : "false"};
  var PROT = '${chain}' ? { chain: '${chain}' } : {};
  var LIG = { chain: '${chain}', resn: '${ligand}' };
  var viewer, surfaceOn = false;

  function focus() {
    if (HAS_LIG) viewer.zoomTo(LIG, 600);
    else viewer.zoomTo();
  }

  window.mlx = {
    refocus: function () { focus(); },
    wholeProtein: function () { viewer.zoomTo(PROT, 600); },
    toggleSurface: function () {
      if (surfaceOn) { viewer.removeAllSurfaces(); surfaceOn = false; viewer.render(); return; }
      status.textContent = 'Building surface…';
      viewer.addSurface($3Dmol.SurfaceType.VDW,
        { opacity: 0.55, color: '#9fb4ff' },
        HAS_LIG ? { chain: '${chain}', within: { distance: 6, sel: LIG } } : PROT,
        PROT
      ).then(function () { surfaceOn = true; status.textContent = ''; viewer.render(); });
    }
  };

  try {
    if (typeof $3Dmol === 'undefined') throw new Error('3Dmol.js did not load (no internet?)');
    Object.defineProperty(window, 'devicePixelRatio', { value: Math.min(window.devicePixelRatio || 1, 2) });
    viewer = $3Dmol.createViewer(document.getElementById('viewer'), { backgroundColor: '#0b1020', antialias: false, cartoonQuality: 5 });

    fetch('${fileUrl}')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (pdb) {
        viewer.addModel(pdb, 'pdb');
        viewer.setStyle(PROT, { cartoon: { color: 'spectrum' } });
        if (HAS_LIG) {
          viewer.setStyle(LIG, {
            stick:  { colorscheme: 'Jmol', radius: 0.22 },
            sphere: { colorscheme: 'Jmol', scale: 0.28 }
          });
          // residues lining the pocket (within 5 Å of the drug) as thin white sticks
          viewer.addStyle({ chain: '${chain}', hetflag: false, byres: true, within: { distance: 5, sel: LIG } },
                          { stick: { radius: 0.1, colorscheme: 'whiteCarbon', opacity: 0.85 } });
          // halo: a translucent yellow sphere on every drug atom
          var la = viewer.selectedAtoms(LIG);
          la.forEach(function (a) {
            viewer.addSphere({ center: { x: a.x, y: a.y, z: a.z }, radius: 1.1, color: '#ffd166', opacity: 0.35 });
          });
          send('ligatoms:' + la.length);
        }
        focus();
        viewer.render();
        status.textContent = '';
        send('rendered');
      })
      .catch(function (e) { status.textContent = 'Load failed: ' + e.message; send('error:' + e.message); });
  } catch (e) { status.textContent = 'Viewer error: ' + e.message; send('error:' + e.message); }
})();
</script>
</body>
</html>`;
}
