window.Easing = {
  easeOutQuad: function(t) { return t * (2 - t); },
  easeOutElastic: function(t) {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};
