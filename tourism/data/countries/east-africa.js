import { defineCountry, e } from './_define.js';

/**
 * The regional overview. Modelled as a country so it inherits the same 27
 * categories, the same resolver and the same components — but it is flagged
 * `isRegion` so pages and reports can treat it separately, and its signature
 * terms are deliberately regional rather than national so the ranker does not
 * fight the member countries for the same photographs.
 */
export default defineCountry({
  slug: 'east-africa',
  name: 'East Africa',
  tagline: 'One Region, Every Landscape',
  eyebrow: 'East africa · one region, every landscape',
  isRegion: true,
  lede:
    'From glaciers on the equator to a salt lake below sea level, from the world\'s ' +
    'largest land migration to granite islands in the middle of the Indian Ocean — ' +
    'fourteen countries that share a rift valley and almost nothing else.',
  summary:
    'The Rift Valley runs the length of it: volcanoes, soda lakes, savannah, rainforest, ' +
    'the Nile, the Red Sea, the Swahili coast and the Indian Ocean islands.',
  palette: { deep: '#12312A', mid: '#0E6E62', light: '#C8B67A' },
  signature: ['east africa', 'east african', 'great rift valley', 'horn of africa'],
  strong: ['african savannah', 'rift valley lakes', 'swahili coast'],
  entries: {
    hero: e(
      'One Region, Every Landscape',
      'the Great Rift Valley opening out in layered escarpments to a distant horizon',
      'east africa great rift valley escarpment panorama landscape',
      { focalPoint: { x: 62, y: 45 } },
    ),
    nature: e(
      'The Rift That Made It All',
      'volcanic cones and soda lakes strung along the floor of the Rift Valley',
      'east africa rift valley volcanic cones soda lake aerial landscape',
    ),
    wildlife: e(
      'The Largest Herds Left on Earth',
      'a wildebeest column strung across open plains at the height of the migration',
      'east africa wildebeest migration column plains wildlife',
    ),
    safari: e(
      'A Continent of Game Roads',
      'a game-drive vehicle stopped on a dirt track as the plains open ahead',
      'east africa safari vehicle game drive track plains savannah',
    ),
    mountains: e(
      'Ice on the Equator',
      'a glaciated equatorial summit standing clear above cloud and moorland',
      'east africa equatorial mountain glacier summit cloud moorland',
    ),
    waterfalls: e(
      'Where the Great Rivers Fall',
      'a great river forcing itself through a narrow rock gorge in full flood',
      'east africa river gorge waterfall rapids rock',
    ),
    lakes: e(
      'Freshwater Seas',
      'fishing boats setting out at dawn across one of the great East African lakes',
      'east africa great lake fishing boats dawn water',
    ),
    beaches: e(
      'From Lakeshore to Reef',
      'dhows drawn up on white sand where the Swahili coast meets the reef',
      'east africa swahili coast dhow white sand reef beach',
    ),
    forests: e(
      'The Last Montane Forests',
      'closed montane rainforest canopy running down a steep escarpment',
      'east africa montane rainforest canopy escarpment forest',
    ),
    adventure: e(
      'Rope, Rapid and Ridge',
      'a raft dropping into white water on a great equatorial river',
      'east africa white water rafting river rapids adventure',
    ),
    culture: e(
      'A Thousand Living Traditions',
      'drummers and dancers performing in the open at a regional gathering',
      'east africa traditional drummers dancers performance culture',
    ),
    people: e(
      'Fourteen Countries, One Neighbourhood',
      'an East African elder in traditional beadwork looking out across open country',
      'east africa elder traditional beadwork portrait',
    ),
    food: e(
      'Charcoal, Spice and Shared Plates',
      'a shared plate of grilled meat and staples on a market table',
      'east africa shared food plate grilled market meal',
    ),
    festivals: e(
      'The Region Gathers',
      'a colourful street procession filling a road at a regional festival',
      'east africa street festival procession crowd colour',
    ),
    crafts: e(
      'Made By Hand, Still',
      'hands weaving coiled fibre into a finished basket',
      'east africa hands weaving basket craft handmade close',
    ),
    historic: e(
      'Stone, Rock and Coral',
      'the weathered coral-stone walls of an old Indian Ocean trading port',
      'east africa coral stone ruins trading port historic',
    ),
    heritage: e(
      'What the Region Keeps',
      'a carved wooden door standing in an old stone quarter',
      'east africa carved wooden door old town heritage',
    ),
    cities: e(
      'The Cities on the Ridge',
      'an East African capital spread across hills under evening cloud',
      'east africa city skyline hills evening aerial capital',
    ),
    architecture: e(
      'Where Africa, Arabia and Europe Met',
      'an arcaded facade mixing Swahili, Indian and European detail',
      'east africa swahili arcade facade architecture building',
    ),
    locallife: e(
      'The Market at Working Hours',
      'traders, produce and movement filling a busy East African market',
      'east africa market traders produce busy street daily life',
    ),
    family: e(
      'Neighbours and Households',
      'children walking home together along a red dirt road',
      'east africa children walking red dirt road village community',
    ),
    outdoors: e(
      'Time Spent Outside',
      'walkers crossing open high country under a wide sky',
      'east africa hiking walkers highland open country outdoors',
    ),
    luxury: e(
      'The Deck With the View',
      'a lodge deck opening onto a valley at golden hour',
      'east africa safari lodge deck valley view golden hour',
    ),
    ecotourism: e(
      'The People Who Keep It',
      'rangers on patrol at first light in a protected area',
      'east africa rangers patrol conservation protected area dawn',
    ),
    scenic: e(
      'The Long View',
      'ridges receding in layers of haze towards a distant escarpment',
      'east africa layered ridges haze escarpment panorama viewpoint',
    ),
    hiddengems: e(
      'The Countries Nobody Lists',
      'an empty track running out across open country towards distant hills',
      'east africa empty track open country distant hills remote',
    ),
    whyvisit: e(
      'Everything, Within One Region',
      'a wide savannah sunset with acacia silhouetted against the light',
      'east africa savannah sunset acacia silhouette landscape',
    ),
  },
});
