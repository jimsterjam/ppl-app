#!/bin/bash

# Script zum automatischen Ersetzen von console.log durch logger.debug
# Für alle Vue-Dateien im client/src Verzeichnis

echo "🔧 Starte Console.log Replacement..."

# Navigiere zum client/src Verzeichnis
cd /Users/testadmin/Documents/bro-split-app/client/src

# Finde alle .vue Dateien
vue_files=$(find . -name "*.vue" -type f)

echo "📋 Gefundene Vue-Dateien:"
echo "$vue_files"
echo ""

# Ersetze console.log mit logger.debug (behalte Emojis)
echo "🔄 Ersetze console.log → logger.debug..."
echo "$vue_files" | xargs sed -i '' -E 's/console\.log\(/logger.debug(/g'

# Ersetze console.warn mit logger.warn
echo "🔄 Ersetze console.warn → logger.warn..."
echo "$vue_files" | xargs sed -i '' -E 's/console\.warn\(/logger.warn(/g'

# Ersetze console.error mit logger.error
echo "🔄 Ersetze console.error → logger.error..."
echo "$vue_files" | xargs sed -i '' -E 's/console\.error\(/logger.error(/g'

echo ""
echo "✅ Replacement abgeschlossen!"
echo ""
echo "⚠️  WICHTIG: Logger-Import muss noch manuell hinzugefügt werden:"
echo "   import { logger } from '@/utils/logger'"
echo ""
echo "📊 Überprüfe Ergebnisse mit:"
echo "   grep -r 'console\.' . --include='*.vue' | wc -l"
