// Gouache texture via SVG filters. Two reusable filters:
//   - wobble: feTurbulence -> feDisplacementMap for hand-drawn, soft, irregular edges.
//   - paper:  a faint fractal-noise grain multiplied over the whole canvas for chalkiness.
// Filter "seed" attrs are fixed so output stays deterministic.

export function filterDefs(seed = 7) {
  const s = (seed % 100) + 1;
  return `
  <!-- gouache: hand-drawn edge displacement + chalky speckle/mottle WITHIN the fill.
       Replaces the old flat-fill look. Applied per shape-group via id "wobble". -->
  <filter id="wobble" x="-14%" y="-14%" width="128%" height="128%">
    <feTurbulence type="fractalNoise" baseFrequency="0.016 0.02" numOctaves="2" seed="${s}" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="8" xChannelSelector="R" yChannelSelector="G" result="disp"/>
    <!-- chalky speckle, clipped to the shape, layered over it -->
    <feTurbulence type="fractalNoise" baseFrequency="0.16 0.2" numOctaves="3" seed="${(s + 5) % 100}" result="chalk"/>
    <feColorMatrix in="chalk" type="matrix"
      values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" result="chalkA"/>
    <feComponentTransfer in="chalkA" result="chalkB">
      <feFuncA type="linear" slope="0.22" intercept="0"/>
    </feComponentTransfer>
    <feComposite in="chalkB" in2="disp" operator="in" result="chalkIn"/>
    <feMerge>
      <feMergeNode in="disp"/>
      <feMergeNode in="chalkIn"/>
    </feMerge>
  </filter>

  <!-- finer wobble + light speckle for small elements (leaves, flowers) -->
  <filter id="wobbleFine" x="-16%" y="-16%" width="132%" height="132%">
    <feTurbulence type="fractalNoise" baseFrequency="0.05 0.06" numOctaves="2" seed="${(s + 11) % 100}" result="warp"/>
    <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="disp"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="2" seed="${(s + 17) % 100}" result="chalk"/>
    <feColorMatrix in="chalk" type="matrix"
      values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" result="chalkA"/>
    <feComponentTransfer in="chalkA" result="chalkB">
      <feFuncA type="linear" slope="0.16" intercept="0"/>
    </feComponentTransfer>
    <feComposite in="chalkB" in2="disp" operator="in" result="chalkIn"/>
    <feMerge>
      <feMergeNode in="disp"/>
      <feMergeNode in="chalkIn"/>
    </feMerge>
  </filter>

  <!-- chalky paper grain, tiled over everything at low opacity -->
  <filter id="paperGrain" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${(s + 23) % 100}" result="g"/>
    <feColorMatrix in="g" type="matrix"
      values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0" result="ga"/>
    <feComponentTransfer in="ga" result="grain">
      <feFuncA type="linear" slope="0.85" intercept="0"/>
    </feComponentTransfer>
    <feComposite in="grain" in2="SourceGraphic" operator="in"/>
  </filter>

  <!-- soft matte blur to knock the digital crispness off fills -->
  <filter id="matte" x="-6%" y="-6%" width="112%" height="112%">
    <feGaussianBlur stdDeviation="0.5"/>
  </filter>`;
}
