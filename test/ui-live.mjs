import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const [cli, vault] = process.argv.slice(2);
if (!cli || !vault) throw new Error("Usage: node test/ui-live.mjs <obsidian-cli> <vault>");
const evaluate = (expression) => {
  const result = execFileSync(cli, [`vault=${vault}`, "eval", `code=(async()=>JSON.stringify(await (${expression})))()`], {
    encoding: "utf8", windowsHide: true, timeout: 20000, maxBuffer: 2 * 1024 * 1024,
  });
  return JSON.parse(result.trim().replace(/^=>\s*/, ""));
};
const inTab = (body) => evaluate(`(()=>{const p=app.plugins.plugins.desklamp,tab=app.setting.activeTab,root=tab.containerEl,w=root.win;${body}})()`);
const baseline = evaluate(`({settings:JSON.stringify(app.plugins.plugins.desklamp.settings),open:app.setting.isOpen,tab:app.setting.activeTab?.id})`);

try {
  evaluate(`(app.setting.open(),app.setting.openTabById("desklamp"),true)`);
  const appearance = inTab(`return {width:root.style.width,light:w.document.body.classList.contains('theme-light'),dark:w.document.body.classList.contains('theme-dark'),active:w.document.body.classList.contains('dl-active'),scroll:root.scrollTop};`);
  try {
    for (const [lang, name] of [["en", "Language"], ["zh", "界面语言"], ["ja", "表示言語"]]) {
      inTab(`p.settings.lang=${JSON.stringify(lang)};tab.display();return true;`);
      const heading = inTab(`return {header:root.querySelector('.dl-settings-heading .setting-item-name').textContent,language:root.querySelector(':scope > .setting-item .setting-item-name').textContent};`);
      assert.equal(heading.header, "Desk Lamp");
      assert.equal(heading.language, name);
      for (const width of ["100%", "560px", "390px", "320px"]) {
        inTab(`root.style.width=${JSON.stringify(width)};return true;`);
        const layout = inTab(`
          const r=root.getBoundingClientRect(),header=w.getComputedStyle(root.querySelector('.dl-settings-header'));
          const controls=Array.from(root.querySelectorAll('select,input,textarea,button')).filter(e=>e.getBoundingClientRect().width>0);
          return {overflow:root.scrollWidth-root.clientWidth,panel:header.borderTopLeftRadius,
            controlsOutside:controls.filter(e=>{const b=e.getBoundingClientRect();return b.left<r.left-1||b.right>r.right+1;}).map(e=>e.tagName),
            radius:w.getComputedStyle(root.querySelector('select')).borderTopLeftRadius,
            font:w.getComputedStyle(root).fontFamily,hostFont:w.getComputedStyle(root).getPropertyValue('--font-interface').trim()};
        `);
        assert.ok(layout.overflow <= 1, `${lang}/${width}: horizontal overflow ${layout.overflow}`);
        assert.deepEqual(layout.controlsOutside, [], `${lang}/${width}: controls leave the settings panel`);
        assert.equal(layout.panel, "12px");
        assert.equal(layout.radius, "8px");
        assert.ok(layout.font && layout.hostFont);
      }
    }

    inTab(`root.style.width='100%';return true;`);
    for (const theme of ["theme-light", "theme-dark"]) {
      const status = inTab(`
        w.document.body.classList.remove('theme-light','theme-dark');w.document.body.classList.add(${JSON.stringify(theme)});
        const probe=w.document.createElement('div');probe.className='status-bar-item is-active';probe.style.display='none';w.document.body.appendChild(probe);
        try {
          w.document.body.classList.remove('dl-active');const before=w.getComputedStyle(probe).color;
          w.document.body.classList.add('dl-active');const after=w.getComputedStyle(probe).color;
          p.settings.enabled=true;p.settings.showStatusBar=true;p.paintRibbon();p.renderStatusBar();tab.display();
          return {before,after,ownStatus:!!document.querySelector('.dl-status-bar.is-active'),
            ribbonLit:!!document.querySelector('.dl-ribbon.dl-lamp-lit'),
            headerLit:!!root.querySelector('.dl-settings-lamp.is-on'),
            motion:getComputedStyle(document.querySelector('.dl-ribbon .svg-icon')).transitionDuration};
        } finally {probe.remove();}
      `);
      assert.equal(status.before, status.after, `${theme}: other status items must keep their color`);
      assert.ok(status.ownStatus && status.ribbonLit && status.headerLit);
      assert.ok(["0.16s", "0s"].includes(status.motion));
      const off = inTab(`p.settings.enabled=false;p.paintRibbon();p.renderStatusBar();tab.display();return {ribbonLit:!!document.querySelector('.dl-ribbon.dl-lamp-lit'),headerLit:!!root.querySelector('.dl-settings-lamp.is-on')};`);
      assert.equal(off.ribbonLit, false);
      assert.equal(off.headerLit, false);
    }

    const keyboard = inTab(`const control=root.querySelector('select');control.focus();return {native:w.document.activeElement===control,name:control.options[control.selectedIndex].textContent};`);
    assert.ok(keyboard.native && keyboard.name);
  } finally {
    inTab(`
      p.settings=JSON.parse(${JSON.stringify(baseline.settings)});
      w.document.body.classList.toggle('theme-light',${appearance.light});w.document.body.classList.toggle('theme-dark',${appearance.dark});
      w.document.body.classList.toggle('dl-active',${appearance.active});
      p.paintRibbon();p.renderStatusBar();tab.display();root.style.width=${JSON.stringify(appearance.width)};root.scrollTop=${appearance.scroll};return true;
    `);
  }
  assert.equal(evaluate(`JSON.stringify(app.plugins.plugins.desklamp.settings)`), baseline.settings, "UI verification must preserve all settings");
  console.log("Live UI checks passed: English/Chinese/Japanese, wide/narrow layouts, family shapes, native keyboard focus, lamp states, and isolated status styling.");
} finally {
  if (baseline.open && baseline.tab) evaluate(`(app.setting.openTabById(${JSON.stringify(baseline.tab)}),true)`);
  else evaluate(`(app.setting.close(),true)`);
}
