window.Physics = {
  computePower: function(duration, jumpFactor) {
    const maxTime = 1500;
    return Math.min(duration, maxTime) * jumpFactor;
  },
  decideDirection: function(last, next) {
    let x = 0, z = 0;
    if ((next.x || 0) < (last.x || 0)) x = -1; else z = -1;
    return { x, z };
  }
};
