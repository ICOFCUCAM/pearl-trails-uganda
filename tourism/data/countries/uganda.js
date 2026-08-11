import { defineCountry, e } from './_define.js';

export default defineCountry({
  slug: 'uganda',
  name: 'Uganda',
  tagline: 'The Pearl of Africa',
  eyebrow: 'Uganda · the pearl of africa',
  lede:
    'Half the world\'s mountain gorillas, the Nile leaving Lake Victoria for the ' +
    'Mediterranean, tree-climbing lions in Ishasha and glaciers on the equator — all ' +
    'inside a country you can cross in a long day\'s drive.',
  summary:
    'Bwindi and Mgahinga for gorillas, Kibale for chimpanzees, Queen Elizabeth and ' +
    'Murchison for the savannah, Jinja for the Nile and the Rwenzori for altitude.',
  isHome: true,
  palette: { deep: '#12312A', mid: '#0E6E62', light: '#C8B67A' },
  signature: [
    'uganda', 'ugandan', 'bwindi', 'kampala', 'murchison falls', 'kibale',
    'queen elizabeth national park', 'ishasha', 'rwenzori', 'jinja',
    'lake bunyonyi', 'mgahinga', 'kidepo', 'ssese', 'entebbe', 'buganda',
    'karamoja', 'sipi falls', 'lake mburo', 'kasubi',
  ],
  strong: ['pearl of africa', 'mountain gorilla', 'shoebill', 'lake victoria', 'source of the nile'],
  entries: {
    hero: e(
      'The Pearl of Africa',
      'mist lifting off the forested ridges of the Bwindi Impenetrable escarpment at first light',
      'uganda bwindi impenetrable forest misty ridges landscape',
      { focalPoint: { x: 66, y: 46 } },
    ),
    nature: e(
      "Across the Pearl's Wild Landscapes",
      'crater lakes and terraced hillsides falling away across the western highlands',
      'uganda crater lakes fort portal highlands landscape',
    ),
    wildlife: e(
      'Wild Encounters',
      'a mountain gorilla resting in the undergrowth of the Bwindi rainforest',
      'uganda mountain gorilla bwindi rainforest wildlife',
    ),
    safari: e(
      'Tracks Through Queen Elizabeth',
      'elephants crossing an open plain in Queen Elizabeth National Park at dusk',
      'uganda queen elizabeth national park elephants safari savannah',
    ),
    mountains: e(
      'Glaciers on the Equator',
      'the glaciated peaks of the Rwenzori range standing above moorland and cloud',
      'uganda rwenzori mountains of the moon glacier moorland',
    ),
    waterfalls: e(
      'Where the Nile Turns to Thunder',
      'the Victoria Nile forcing itself through the seven-metre gap at Murchison Falls',
      'uganda murchison falls victoria nile gorge waterfall',
    ),
    lakes: e(
      'Where the Nile Begins',
      'fishing boats on the still water of Lake Bunyonyi between terraced islands',
      'uganda lake bunyonyi islands boats terraced hills',
    ),
    beaches: e(
      'The Inland Sea',
      'the sand shoreline of the Ssese Islands on Lake Victoria under afternoon light',
      'uganda ssese islands lake victoria shoreline beach',
    ),
    forests: e(
      'Into the Mist of Bwindi',
      'tall closed canopy in Kibale Forest with light coming down through the vines',
      'uganda kibale forest canopy rainforest interior',
    ),
    adventure: e(
      'White Water at the Source',
      'a raft dropping into white water on the Nile below Jinja',
      'uganda jinja nile white water rafting adventure',
    ),
    culture: e(
      'Culture, Rhythm & Heritage',
      'Buganda dancers in bark cloth and raffia performing to drums',
      'uganda buganda traditional dance drums culture',
    ),
    people: e(
      'The Faces of the Pearl',
      'a Karamojong elder in beaded collars standing outside a manyatta in Karamoja',
      'uganda karamojong people karamoja portrait traditional dress',
    ),
    food: e(
      'Charcoal, Matoke & Groundnut',
      'a rolex being folded on a roadside charcoal griddle in Kampala',
      'uganda rolex street food kampala matoke market',
    ),
    festivals: e(
      'Drums, Colour & Gathering',
      'drummers and dancers in procession at a Buganda kingdom celebration',
      'uganda festival celebration drummers procession crowd',
    ),
    crafts: e(
      'Bark Cloth and Basketry',
      'a weaver working a coiled raffia basket in a Ugandan craft market',
      'uganda basket weaving craft market handmade raffia',
    ),
    historic: e(
      'The Kingdoms That Came Before',
      'the thatched dome of the Kasubi Tombs, burial place of the Buganda kings',
      'uganda kasubi tombs buganda kings thatched historic site',
    ),
    heritage: e(
      'Kingdoms, Clans & Custody',
      'the drum makers of Mpambire finishing a royal Buganda drum by hand',
      'uganda mpambire drum makers buganda heritage craft',
    ),
    cities: e(
      'Kampala, Built on Seven Hills',
      'the hills and rooftops of Kampala running to the horizon in evening light',
      'kampala uganda city skyline hills aerial',
    ),
    architecture: e(
      'Minarets Over the Hills',
      'the domed Uganda National Mosque on Old Kampala hill',
      'kampala uganda national mosque architecture dome',
    ),
    locallife: e(
      'Boda Bodas and Market Mornings',
      'traders and boda boda riders moving through Owino market in Kampala',
      'kampala uganda market street traders boda boda daily life',
    ),
    family: e(
      'Villages Along the Escarpment',
      'children walking a red murram road between banana gardens in western Uganda',
      'uganda village children banana plantation rural community',
    ),
    outdoors: e(
      'Walking Country',
      'trekkers following a ranger along a forest path in Bwindi',
      'uganda bwindi trekking hikers forest trail ranger',
    ),
    luxury: e(
      'A Deck Above the Kazinga',
      'a lodge deck looking out over the Kazinga Channel at golden hour',
      'uganda safari lodge deck kazinga channel luxury view',
    ),
    ecotourism: e(
      'Conservation That Pays the Parish',
      'a Uganda Wildlife Authority ranger briefing trekkers at a park headquarters',
      'uganda wildlife authority ranger conservation briefing eco tourism',
    ),
    scenic: e(
      'The Long View West',
      'the Ishasha plains running to the Rwenzori foothills under afternoon cloud',
      'uganda ishasha plains savannah viewpoint rwenzori distance',
    ),
    hiddengems: e(
      'The Places Nobody Photographs',
      'the terraces of Sipi Falls dropping off the shoulder of Mount Elgon',
      'uganda sipi falls mount elgon waterfall terraces',
    ),
    whyvisit: e(
      'One Country, Every Africa',
      'a shoebill standing motionless in the papyrus at the edge of a swamp',
      'uganda shoebill stork papyrus swamp mabamba',
    ),
  },
});
