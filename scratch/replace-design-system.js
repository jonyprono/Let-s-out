const fs = require('fs');
const path = require('path');

const files = [
  'apps/web/src/app/components/CreateEvent.tsx',
  'apps/web/src/app/components/EventDetails.tsx',
  'apps/web/src/app/components/Profile.tsx',
  'apps/web/src/app/components/Settings.tsx',
  'apps/web/src/components/shared/EventCard.tsx',
  'apps/web/src/app/components/Onboarding.tsx',
  'apps/web/src/app/components/Explorer.tsx'
];

const rootDir = 'c:\\Users\\carlo\\Desktop\\Lets out';

files.forEach(relPath => {
  const filePath = path.join(rootDir, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replacements for colors
  content = content.replace(/bg-\[#FF9F1C\]/g, 'bg-action-primary active:bg-action-primary-hover');
  content = content.replace(/text-\[#FF9F1C\]/g, 'text-action-primary');
  content = content.replace(/border-\[#FF9F1C\]/g, 'border-action-primary');
  content = content.replace(/focus:border-\[#FF9F1C\]/g, 'focus:border-action-primary');
  content = content.replace(/focus-within:ring-\[#FF9F1C\]\/20/g, 'focus-within:ring-action-primary/20');
  content = content.replace(/ring-\[#FF9F1C\]\/20/g, 'ring-action-primary/20');
  
  // Neutral Gray borders and backgrounds
  content = content.replace(/border-gray-200/g, 'border-border-primary');
  content = content.replace(/border-gray-300/g, 'border-border-primary');
  content = content.replace(/border-\[#E5E5E5\]/g, 'border-border-primary');
  
  // Screens background
  if (relPath.endsWith('Onboarding.tsx')) {
    content = content.replace(/bg-white flex flex-col/g, 'bg-background-default flex flex-col');
  }
  content = content.replace(/bg-white/g, 'bg-background-white');
  content = content.replace(/bg-orange-50/g, 'bg-brand-orange-50');
  content = content.replace(/text-gray-500/g, 'text-text-secondary');
  content = content.replace(/text-gray-600/g, 'text-text-secondary');
  content = content.replace(/bg-\[#FFD99A\]/g, 'bg-action-primary/50');
  
  // Style properties patterns
  content = content.replace(/#FF9F1C/g, 'var(--action-primary)');
  content = content.replace(/#FFCA28/g, 'var(--color-brand-yellow-400)');
  content = content.replace(/#FFB75E/g, 'var(--color-brand-orange-400)');
  content = content.replace(/#FFAE42/g, 'var(--color-brand-orange-400)');
  content = content.replace(/#FFF0D9/g, 'var(--color-brand-orange-50)');
  content = content.replace(/#FFF8F1/g, 'var(--color-brand-orange-50)');
  content = content.replace(/#FFD99A/g, 'var(--color-brand-orange-200)');
  content = content.replace(/#E6F9F1/g, 'var(--color-functional-green-positive)/10');
  content = content.replace(/#00A859/g, 'var(--color-functional-green-positive)');
  content = content.replace(/#00A35F/g, 'var(--color-functional-green-positive)');

  // Spacing patterns in ClassNames (16px spacing scale)
  content = content.replace(/\bgap-4\b/g, 'gap-200');
  content = content.replace(/\bp-4\b/g, 'p-200');
  content = content.replace(/\bpx-4\b/g, 'px-200');
  content = content.replace(/\bpy-4\b/g, 'py-200');
  content = content.replace(/\bm-4\b/g, 'm-200');
  content = content.replace(/\bmx-4\b/g, 'mx-200');
  content = content.replace(/\bmy-4\b/g, 'my-200');
  content = content.replace(/\bmb-4\b/g, 'mb-200');
  content = content.replace(/\bmt-4\b/g, 'mt-200');
  content = content.replace(/\bmr-4\b/g, 'mr-200');
  content = content.replace(/\bml-4\b/g, 'ml-200');
  content = content.replace(/\bspace-y-4\b/g, 'space-y-200');
  content = content.replace(/\bspace-x-4\b/g, 'space-x-200');

  // Multiples spacing scale (12px = 150)
  content = content.replace(/\bgap-3\b/g, 'gap-150');
  content = content.replace(/\bp-3\b/g, 'p-150');
  content = content.replace(/\bpx-3\b/g, 'px-150');
  content = content.replace(/\bpy-3\b/g, 'py-150');
  content = content.replace(/\bmb-3\b/g, 'mb-150');
  content = content.replace(/\bmt-3\b/g, 'mt-150');
  content = content.replace(/\bspace-y-3\b/g, 'space-y-150');
  content = content.replace(/\bspace-x-3\b/g, 'space-x-150');

  // Check and save changes
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Successfully integrated Figma variables in: ${relPath}`);
  } else {
    console.log(`No changes needed in: ${relPath}`);
  }
});
