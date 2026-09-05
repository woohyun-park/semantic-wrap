---
"@semantic-wrap/core": minor
"@semantic-wrap/react": patch
---

Add an opt-in `nearbyLayouts()` calculator that measures candidate lines near native break positions and uses DP with Pareto pruning within those neighborhoods. Forward validated native breaks to calculators and allow them in plan calculations. The default remains `optimalLayouts()` because local search can miss globally better layouts.

Handle empty native text in the React DOM measurer without throwing.
