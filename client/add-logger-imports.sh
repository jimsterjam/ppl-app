#!/bin/bash

# Script zum Hinzufügen von logger-Imports zu Vue-Dateien
# die logger.debug/warn/error verwenden

cd /Users/testadmin/Documents/bro-split-app/client/src

# Liste der Dateien die logger verwenden (haben logger.debug/warn/error)
files_with_logger=$(grep -l "logger\." views/*.vue components/*.vue 2>/dev/null)

echo "📋 Dateien die Logger verwenden:"
echo "$files_with_logger"
echo ""

for file in $files_with_logger; do
  # Prüfe ob Import bereits existiert
  if grep -q "import.*logger.*from.*@/utils/logger" "$file"; then
    echo "✅ $file - Import bereits vorhanden"
  else
    echo "🔧 $file - Füge Import hinzu..."
    
    # Finde die letzte import-Zeile
    last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
    
    if [ -n "$last_import_line" ]; then
      # Füge nach der letzten import-Zeile ein
      sed -i '' "${last_import_line}a\\
import { logger } from '@/utils/logger'
" "$file"
      echo "   ✅ Import hinzugefügt nach Zeile $last_import_line"
    else
      echo "   ⚠️  Keine imports gefunden - überspringe"
    fi
  fi
done

echo ""
echo "✅ Logger-Imports hinzugefügt!"
echo ""
echo "📊 Überprüfung:"
grep -l "import.*logger" views/*.vue components/*.vue 2>/dev/null | wc -l
echo "Dateien mit logger-Import"
