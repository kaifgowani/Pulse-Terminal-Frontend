const mock = new Proxy({}, {
  get: function(target, prop) {
    if (prop === 'default') return mock;
    if (prop === '__esModule') return true;
    if (prop === 'useSharedValue') return (val) => ({ value: val });
    if (prop === 'useDerivedValue') return (fn) => ({ value: fn() });
    if (prop === 'useAnimatedStyle') return () => ({});
    if (prop === 'useAnimatedProps') return () => ({});
    if (prop === 'withTiming') return (val) => val;
    if (prop === 'withSpring') return (val) => val;
    if (prop === 'runOnJS') return (fn) => fn;
    if (prop === 'runOnUI') return (fn) => fn;
    if (prop === 'makeMutable') return (val) => ({ value: val });
    if (prop === 'cancelAnimation') return () => {};
    return function() { return {}; };
  }
});
module.exports = mock;
