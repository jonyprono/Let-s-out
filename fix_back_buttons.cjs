const fs = require('fs');
const path = require('path');

const dir = 'apps/web/src/app/components';
const files = [];

function walk(currentDir) {
  const list = fs.readdirSync(currentDir);
  for (const file of list) {
    const full = path.join(currentDir, file);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) files.push(full);
  }
}
walk(dir);

const targetClass = 'w-10 h-10 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform';
const iconClass = 'w-6 h-6 text-gray-800 dark:text-gray-200';

let updatedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Regex to match back buttons:
  // We'll look for `<button ... onClick={...} ... > <ChevronLeft | NavArrowLeft | ArrowLeft ... /> </button>`
  // This is too complex for regex. We'll find instances of `ChevronLeft`, `NavArrowLeft`, `ArrowLeft` inside buttons.

  // Let's replace common patterns:
  content = content.replace(
    /<button([^>]*?)className="([^"]*?w-[89]\s+h-[89][^"]*?|[^"]*?active:opacity-70[^"]*?)"([^>]*)>\s*<(ChevronLeft|NavArrowLeft|ArrowLeft)[^>]*?>\s*<\/button>/g,
    `<button$1className="absolute left-0 ${targetClass}"$3>\n            <$4 className="${iconClass}" strokeWidth={2.5} />\n          </button>`
  );

  // General replace for back buttons in flex headers
  content = content.replace(
    /<button([^>]*?)className="([^"]*?)"([^>]*)>\s*<(ChevronLeft|NavArrowLeft|ArrowLeft)([^>]*?)>\s*<\/button>/g,
    (match, p1, p2, p3, icon, iconProps) => {
      // If it's already updated, skip
      if (p2.includes('w-10 h-10 bg-[#F5F5F5]')) return match;
      
      // If it contains w-5 h-5 or something, we replace
      // Let's preserve `absolute left-0` if it's there
      const isAbsolute = p2.includes('absolute') ? 'absolute left-0 ' : '';
      return `<button${p1}className="${isAbsolute}${targetClass}"${p3}>\n            <${icon} className="${iconClass}" strokeWidth={2.5} />\n          </button>`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(file, content);
    updatedCount++;
    console.log('Updated ' + file);
  }
}

console.log('Total updated: ' + updatedCount);
