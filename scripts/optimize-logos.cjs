const fs = require('fs');

const orig = fs.readFileSync('public/veil-logo.svg', 'utf8');
const circles = orig.match(/<circle[^>]+>/g);

if (!circles || circles.length === 0) {
  console.error('No circles found!');
  process.exit(1);
}

const circlesBody = circles.join('\n  ');
const cleanSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  ${circlesBody}
</svg>
`;

fs.writeFileSync('public/veil-logo.svg', cleanSvg);
fs.writeFileSync('public/logo/veil-logo.svg', cleanSvg);

const whiteSvg = cleanSvg.replace(/#1a1a1a/g, '#ffffff');
fs.writeFileSync('public/veil-logo-white.svg', whiteSvg);
fs.writeFileSync('public/logo/veil-logo-white.svg', whiteSvg);

console.log(`Generated clean SVGs: ${circles.length} circles, clean size ${cleanSvg.length} bytes.`);
