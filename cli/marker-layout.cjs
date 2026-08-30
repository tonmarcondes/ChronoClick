// Keep badges inside the screenshot and avoid hiding earlier badges.
module.exports = function placeMarkers(items, {left, width, height, size}) {
  const placed=[];
  const clamp=(n,min,max)=>Math.max(min,Math.min(Math.max(min,max),n));
  for(const item of items){
    let best;
    for(let ring=0;ring<12&&!best;ring++){
      for(let direction=0;direction<(ring?16:1);direction++){
        const angle=direction*Math.PI/8;
        const candidate={...item,leftPt:clamp(item.leftPt+Math.cos(angle)*ring*(size+2),left,left+width-size),topPt:clamp(item.topPt+Math.sin(angle)*ring*(size+2),0,height-size)};
        if(!placed.some(other=>Math.abs(other.leftPt-candidate.leftPt)<size+1&&Math.abs(other.topPt-candidate.topPt)<size+1)){best=candidate;break;}
      }
    }
    placed.push(best||{...item,leftPt:clamp(item.leftPt,left,left+width-size),topPt:clamp(item.topPt,0,height-size)});
  }
  return placed;
};
