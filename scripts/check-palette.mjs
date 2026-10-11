import { readFileSync } from 'node:fs';
// Full-severity linear-RGB matrices from Machado, Oliveira & Fernandes (2009).
// https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
// CI use: node scripts/check-palette.mjs. ΔE76 >= 10 is our palette design gate,
// not a claim of universal perception. Labels/shapes remain required.
const source = readFileSync(new URL('../src/data/palette.ts', import.meta.url), 'utf8');
const palette = Object.fromEntries([...source.matchAll(/(\w+):\s*'(#[0-9a-f]{6})'/g)].map(match => [match[1],match[2]]));
const roles = ['data','truth','focus','variation','error','output'];
const simulations = {
    normal: [[1,0,0],[0,1,0],[0,0,1]],
    protanopia: [[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
    deuteranopia: [[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.01182,0.04294,0.968881]],
    tritanopia: [[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.3039]],
};
const linear = hex => [1,3,5].map(start => {
    const value = parseInt(hex.slice(start,start+2),16)/255;
    return value <= 0.04045 ? value/12.92 : ((value+0.055)/1.055)**2.4;
});
const luminance = rgb => rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
const lab = rgb => {
    const xyz = [rgb[0]*0.4124564+rgb[1]*0.3575761+rgb[2]*0.1804375, rgb[0]*0.2126729+rgb[1]*0.7151522+rgb[2]*0.072175, rgb[0]*0.0193339+rgb[1]*0.119192+rgb[2]*0.9503041];
    const curve = value => value > (6/29)**3 ? Math.cbrt(value) : value/(3*(6/29)**2)+4/29;
    const [x,y,z] = xyz.map((value,i) => curve(value/[0.95047,1,1.08883][i]));
    return [116*y-16,500*(x-y),200*(y-z)];
};
let failures = 0;
const contrast = Object.fromEntries([...roles,'axis','basis1','basis2','basis3'].map(role => {
    const foreground = luminance(linear(palette[role]));
    const values = ['#0b0f19','#050508'].map(background => (foreground+0.05)/(luminance(linear(background))+0.05));
    if (Math.min(...values)<3) failures++;
    return [role,values.map(value=>Number(value.toFixed(2)))];
}));
const distances = {};
for (const [name,matrix] of Object.entries(simulations)) {
    const values = roles.map(role => lab(matrix.map(row => Math.max(0,Math.min(1,row.reduce((sum,value,i)=>sum+value*linear(palette[role])[i],0))))));
    distances[name] = [];
    for (let a=0;a<roles.length;a++) for (let b=a+1;b<roles.length;b++) {
        const distance = Math.hypot(...values[a].map((value,i)=>value-values[b][i]));
        distances[name].push({pair:`${roles[a]}/${roles[b]}`,deltaE76:Number(distance.toFixed(2))});
        if (distance<10) failures++;
    }
}
console.log(JSON.stringify({contrast, distances, minimumContrast:3, minimumDeltaE76:10, failures, note:'Basis glyphs use coordinate letters and are assessed for contrast, not as semantic roles.'},null,2));
if (failures) process.exitCode=1;
