// Soldier faces. Every specialty + sex has one portrait per look, so a squad can be anyone.
// Look 0 is the original portrait set; the rest are tokens `soldier-<spec>-<sex>-<look>`.
// Recruits get a random look; the player can change it on the Soldier's page.
export const LOOKS = [
  { id: 0, name: 'Face 1', prompt: '' },
  { id: 1, name: 'Face 2', prompt: 'of Black African descent with dark brown skin' },
  { id: 2, name: 'Face 3', prompt: 'of East Asian descent' },
  { id: 3, name: 'Face 4', prompt: 'of South Asian Indian descent with brown skin' },
  { id: 4, name: 'Face 5', prompt: 'of Latino Hispanic descent with tan skin' },
  { id: 5, name: 'Face 6', prompt: 'of Middle Eastern descent with olive skin' },
  { id: 6, name: 'Face 7', prompt: 'of Pacific Islander Polynesian descent with brown skin' },
  { id: 7, name: 'Face 8', prompt: 'of Native American descent with warm brown skin' },
];
export const LOOK_COUNT = LOOKS.length;
