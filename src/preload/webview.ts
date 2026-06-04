// Intercept window.open and target="_blank" so all navigation stays
// in the current page.
var TOP = window;

function patchWindow(win: Window) {
  if ((win as any).__omW) return;
  (win as any).__omW = true;

  var nativeOpen = win.open.bind(win);
  win.open = function (url?: string | URL, target?: string, features?: string): Window | null {
    if (url && typeof url === "string" && url.length > 0 && !url.startsWith("javascript:")) {
      TOP.location.href = url;
      return null;
    }
    return nativeOpen(url, target, features);
  };
}

function patchDocument(doc: Document) {
  if ((doc as any).__omD) return;
  (doc as any).__omD = true;

  doc.addEventListener("click", function (e) {
    var target = e.target as HTMLElement;
    var a = target.closest("a") as HTMLAnchorElement | null;
    var form = target.closest("form") as HTMLFormElement | null;

    if (a && a.target === "_blank" && a.href && !a.href.startsWith("javascript:")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      TOP.location.href = a.href;
      return;
    }

    if (form && form.target === "_blank") {
      e.preventDefault();
      e.stopImmediatePropagation();
      form.target = "_self";
      form.submit();
    }
  }, true);
}

patchWindow(window);
patchDocument(document);

new MutationObserver(function () {
  document.querySelectorAll("iframe").forEach(function (iframe) {
    try {
      var w = iframe.contentWindow;
      var d = iframe.contentDocument || w?.document;
      if (w) patchWindow(w);
      if (d) patchDocument(d);
    } catch (_) { /* cross-origin */ }
  });
}).observe(document.documentElement, { childList: true, subtree: true });
