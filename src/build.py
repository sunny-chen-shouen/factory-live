import sys, pathlib
root = pathlib.Path(__file__).parent
app = root / 'app'
order = ['qrlib.js', 'calc.js', 'api.js', 'i18n.js', 'core.js', 'views_team.js', 'views_screen.js', 'views_host.js', 'fx.js', 'juice.js', 'main.js']
script = '\n'.join((app / f).read_text() for f in order)
script = script.replace('</script', '<\\/script')
html = (app / 'index.src.html').read_text()
html = html.replace('/*STYLE*/', (app / 'style.css').read_text()).replace('/*SCRIPT*/', script)
cfg = sys.argv[1:]  # optional: url key
if len(cfg) == 2:
    html = html.replace('window.FL_CONFIG = { url: "", key: "" };', 'window.FL_CONFIG = { url: "%s", key: "%s" };' % (cfg[0], cfg[1]))
out = root / 'dist'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(html)
print('built', out / 'index.html', len(html), 'bytes')
