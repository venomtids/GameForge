// Gerador do JOGO, não da engine. Pode ser alterado junto com o controlador.
function createWorld(seed, size) {
  const height=24, blocks=Array(size*size*height).fill(0);
  const noise=(x,z,k=0)=>{const n=Math.sin(x*127.1+z*311.7+seed*.013+k*73.3)*43758.5453;return n-Math.floor(n);};
  const at=(x,y,z)=>x+size*(z+size*y);
  const set=(x,y,z,v)=>{if(x>=0&&x<size&&z>=0&&z<size&&y>=0&&y<height)blocks[at(x,y,z)]=v;};
  const get=(x,y,z)=>x>=0&&x<size&&z>=0&&z<size&&y>=0&&y<height?blocks[at(x,y,z)]:0;
  const heights=[];
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    let h=4+Math.floor((Math.sin(x*.22+seed)+Math.cos(z*.25))*1.3+1.5);
    if(Math.abs(x-size/2)<4&&Math.abs(z-size/2)<4)h=5;
    const lake=x>2&&x<10&&z>2&&z<10;if(lake)h=3;
    heights[x+z*size]=h;
    for(let y=0;y<=h;y++){
      let t=y===0?1:y===h?(lake?7:2):y>h-2?3:4;
      if(t===4){const n=noise(x,z,y);if(n<.035)t=12;else if(n<.12)t=11;else if(n<.25)t=10;}
      set(x,y,z,t);
    }
    if(lake)for(let y=h+1;y<=4;y++)set(x,y,z,8);
  }
  // Garantias de progressão: depósitos próximos, mas ainda precisam ser minerados.
  for(let i=0;i<6;i++){set(size/2+5,2+i%2,size/2-3+Math.floor(i/2),11);set(size/2-5,2,size/2-4+i,10);}
  set(size/2+6,1,size/2-3,12);
  const plant=(x,z)=>{const h=heights[x+size*z];if(get(x,h,z)!==2)return;for(let y=1;y<=4;y++)set(x,h+y,z,5);for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)for(let dy=3;dy<=5;dy++)if(Math.abs(dx)+Math.abs(dz)+(dy===5?1:0)<4&&get(x+dx,h+dy,z+dz)===0)set(x+dx,h+dy,z+dz,6);};
  for(let z=3;z<size-3;z+=5)for(let x=3;x<size-3;x+=5)if(Math.abs(x-size/2)>4||Math.abs(z-size/2)>4){if(noise(x,z)> .15)plant(x,z);}
  plant(size/2+4,size/2+2);plant(size/2-4,size/2+1);
  return blocks;
}
