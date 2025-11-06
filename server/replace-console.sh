#!/bin/bash

# Backend Console.log Replacement

cd /Users/testadmin/Documents/bro-split-app/server

echo "🔧 Backend: Console.log Replacement..."

# Ersetze in routes/
sed -i '' -E 's/console\.log\(/logger.debug(/g' routes/workouts.js
sed -i '' -E 's/console\.warn\(/logger.warn(/g' routes/workouts.js
sed -i '' -E 's/console\.error\(/logger.error(/g' routes/workouts.js

sed -i '' -E 's/console\.log\(/logger.debug(/g' routes/exercises.js
sed -i '' -E 's/console\.warn\(/logger.warn(/g' routes/exercises.js
sed -i '' -E 's/console\.error\(/logger.error(/g' routes/exercises.js

# Ersetze in server.js (nur warnings und errors, nicht die Startup-Messages)
sed -i '' -E 's/console\.warn\(/logger.warn(/g' server.js
sed -i '' -E 's/console\.error\(/logger.error(/g' server.js

echo "✅ Replacement abgeschlossen!"
echo ""
echo "📊 Verbleibende console.logs:"
grep -r "console\." routes/ | wc -l
