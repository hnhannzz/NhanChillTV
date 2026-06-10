const ANIMAL_NAMES = [
  'alpaca', 'anteater', 'bat', 'beetle', 'butterfly', 'camel', 'cat', 'chameleon', 'cobra', 'crab',
  'crocodile', 'dog', 'duck', 'elephant', 'elk', 'fish', 'frog', 'giraffe', 'hippo', 'husky',
  'kangaroo', 'lion', 'macaw', 'manatee', 'mianyang', 'monkey', 'mouse', 'octopus', 'ostrich', 'owl',
  'panda', 'pelican', 'penguin', 'pig', 'raccoon', 'rhino', 'rooster', 'sea-ray', 'shark', 'sloth',
  'snake', 'spider', 'squirrel', 'swan', 'the-cow', 'tiger', 'toucan', 'turtle', 'whale', 'white-rabbit',
];

export const ANIMAL_AVATARS = ANIMAL_NAMES.map(name => ({
  name: name.replace(/-/g, ' '),
  src: `/avatar-packs/animals/${name}-svgrepo-com.svg`,
}));
