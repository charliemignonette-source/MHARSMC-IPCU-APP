const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// The Recent Intelligence Analytics block ends with:
// `                    </div>                  ))}               </div>            </div>`
// Let's find this point.
const recentIntelRegex = /Recent Intelligence Analytics.*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/s;
let match = code.match(recentIntelRegex);

// Oh wait, let's just find the `Daily Trend Chart` comment and remove everything from there to the end of the `grid-cols-12` grid, or just everything up to `</div></div></div></div>  );}`.
const trendStartIdx = code.indexOf('{/* Daily Trend Chart */}');
const endIdx = code.lastIndexOf('</div>');

if (trendStartIdx !== -1) {
  const replacement = `          </div>
        </div>
      </div>
    </div>
  );
}`;
  code = code.substring(0, trendStartIdx) + replacement;
}

// Let's also remove `ComplianceCell` if it exists at the bottom
const compCellIdx = code.indexOf('function ComplianceCell');
if (compCellIdx !== -1) {
  code = code.substring(0, compCellIdx);
  // Re-add closing if we accidentally stripped it
  if (!code.trim().endsWith('}')) {
    code += `\n  );\n}`;
  }
}

// Wait, the components at the bottom might include BundleSummaryCard. We CANNOT remove BundleSummaryCard!
