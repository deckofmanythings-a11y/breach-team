// Pointer-based drag and drop for gear icons (mouse, pen and touch alike; HTML5 drag events don't
// fire on touch screens). Sources carry data-drag; targets carry data-drop. New file (stale-cache rule).
//
// enableGearDrag(root, { start(src) -> void, drop(src, target) -> void, end() -> void })
//   src / target are the elements; read their dataset. `start` can mark valid targets.
const THRESHOLD = 6, EDGE = 70;

export function enableGearDrag(root, { start, drop, end }) {
  let pend = null, drag = null, hover = null, raf = 0, lastY = 0;
  const targetAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-drop]') || null;
  const setHover = (t) => { if (t === hover) return; hover?.classList.remove('drop-hover'); hover = t; hover?.classList.add('drop-hover'); };
  const autoscroll = () => {   // near the top or bottom edge: scroll so far-away Soldiers can be reached
    if (!drag) return;
    const v = lastY < EDGE ? -(EDGE - lastY) / 4 : lastY > innerHeight - EDGE ? (lastY - innerHeight + EDGE) / 4 : 0;
    if (v) window.scrollBy(0, v);
    raf = requestAnimationFrame(autoscroll);
  };
  const finish = () => {
    cancelAnimationFrame(raf);
    drag?.ghost.remove(); setHover(null);
    document.body.classList.remove('gear-dragging');
    drag?.src.classList.remove('drag-src');
    if (drag) end?.();
    pend = drag = null;
  };
  root.addEventListener('pointerdown', (e) => {
    const src = e.target.closest?.('[data-drag]');
    if (!src || !root.contains(src) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pend = { src, x: e.clientX, y: e.clientY, id: e.pointerId };
    try { src.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  });
  root.addEventListener('pointermove', (e) => {
    if (!pend || e.pointerId !== pend.id) return;
    lastY = e.clientY;
    if (!drag) {
      if (Math.hypot(e.clientX - pend.x, e.clientY - pend.y) < THRESHOLD) return;
      const r = pend.src.getBoundingClientRect();
      const ghost = pend.src.cloneNode(true);
      ghost.removeAttribute('data-tip'); ghost.removeAttribute('data-drag');
      ghost.classList.add('drag-ghost');
      ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
      document.body.append(ghost);
      drag = { src: pend.src, ghost, dx: r.width / 2, dy: r.height / 2 };
      drag.src.classList.add('drag-src');
      document.body.classList.add('gear-dragging');
      for (const t of document.querySelectorAll('body > .tip')) t.hidden = true;
      start?.(drag.src);
      raf = requestAnimationFrame(autoscroll);
    }
    drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px)`;
    setHover(targetAt(e.clientX, e.clientY));
  });
  root.addEventListener('pointerup', (e) => {
    if (!pend || e.pointerId !== pend.id) return;
    if (drag) {
      const src = drag.src, t = targetAt(e.clientX, e.clientY);
      // The card under the pointer would also get a click (opening the Soldier): swallow it once.
      const eat = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 50);
      if (t) drop(src, t);   // before finish(): end() clears the valid-target marks drop() reads
      finish();
      return;
    }
    pend = null;
  });
  root.addEventListener('pointercancel', finish);
}
