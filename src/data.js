window.DATA={
 skins:[
 {id:'cherry',name:'Cherry',rarity:'common',icon:'🐰',weapon:'Pink Bloom',skill:'Bloom Burst',desc:'Balanced starter. Fires pink bloom bolts.',stats:{damage:0,speed:0,hp:0}},
 {id:'sakura',name:'Sakura Cherry',rarity:'common',icon:'🌸',weapon:'Petal Shot',skill:'Petal Dash',desc:'Faster projectiles and a short invulnerable dash.',stats:{damage:-2,speed:20,hp:0}},
 {id:'moon',name:'Moon Bunny',rarity:'rare',icon:'🌙',weapon:'Moon Shard',skill:'Lunar Barrage',desc:'Rare skin. Fires piercing moon shards and releases a circular barrage.',stats:{damage:5,speed:-8,hp:10}}
 ],
 slots:['Weapon','Helmet','Armor','Gloves','Boots','Ring','Necklace'],
 types:{assault:{name:'Crimson',label:'Offensive',icon:'⚔',stats:['damage','crit','attackSpeed']},guardian:{name:'Azure',label:'Defensive',icon:'🛡',stats:['maxHp','armor','regen']},vanguard:{name:'Verdant',label:'Hybrid',icon:'⚖',stats:['damage','maxHp','moveSpeed']}},
 upgrades:[
 {name:'Bloom Power',desc:'+20% damage',apply:p=>p.damage*=1.2},
 {name:'Rapid Bloom',desc:'+15% attack speed',apply:p=>p.fireInterval*=.85},
 {name:'Heart Petal',desc:'+25 maximum HP and heal',apply:p=>{p.maxHp+=25;p.hp=Math.min(p.maxHp,p.hp+25)}},
 {name:'Swift Step',desc:'+12% movement speed',apply:p=>p.speed*=1.12},
 {name:'Critical Bloom',desc:'+8% critical chance',apply:p=>p.crit+=.08},
 {name:'Magnet Flower',desc:'+35 pickup radius',apply:p=>p.magnet+=35},
 {name:'Twin Bloom',desc:'+1 projectile',apply:p=>p.multishot=Math.min(5,p.multishot+1)},
 {name:'Piercing Petal',desc:'+1 enemy pierced',apply:p=>p.pierce+=1},
 {name:'Skill Flow',desc:'-18% skill cooldown',apply:p=>p.skillCooldown*=.82}
 ]
};
