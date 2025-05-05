#!/bin/zsh

# Define the installation directory in your home with absolute path
INSTALL_DIR="/Users/nikitagorokhov/dev/cursor-memory-bank"
ZSHRC="/Users/nikitagorokhov/.zshrc"

# Clone the repository
echo "🧠 Cloning Cursor Memory Bank..."
if [ ! -d "$INSTALL_DIR" ]; then
    git clone git@github.com:vanzan01/cursor-memory-bank.git "$INSTALL_DIR"
else
    echo "📦 Memory bank already exists at $INSTALL_DIR"
fi

# Create global aliases
echo "\n📝 Adding global aliases to $ZSHRC..."

# Add these lines to .zshrc if they don't exist
ALIASES=(
  'alias init-memory-bank="cp -r /Users/nikitagorokhov/dev/cursor-memory-bank/.cursor/rules/* ./.cursor/rules/"'
)

for alias in "${ALIASES[@]}"; do
  if ! grep -q "$alias" "$ZSHRC"; then
    echo "$alias" >> "$ZSHRC"
  fi
done

# Create .cursor/rules directory in current project if it doesn't exist
echo "\n📁 Creating init-memory-bank function..."
cat >> "$ZSHRC" << 'EOL'

function init-memory-bank() {
    local CURRENT_DIR="$PWD"
    local RULES_DIR="$CURRENT_DIR/.cursor/rules"
    
    # Create base directory structure
    echo "🏗️  Creating directory structure..."
    mkdir -p "$RULES_DIR"/{Core,Level3,Phases/CreativePhase,visual-maps/van_mode_split/{van-qa-checks,van-qa-utils}}
    
    # Copy files with proper directory creation
    echo "📚 Copying memory bank rules..."
    cp -R /Users/nikitagorokhov/dev/cursor-memory-bank/.cursor/rules/* "$RULES_DIR/"
    
    if [ $? -eq 0 ]; then
        echo "✅ Memory bank initialized successfully in: $CURRENT_DIR"
    else
        echo "❌ Error copying files. Please check permissions and try again."
        return 1
    fi
}

# Tab completion for init-memory-bank
compdef _files init-memory-bank
EOL

# Source the updated .zshrc
source "$ZSHRC"

echo "\n✨ Installation complete! You can now use:"
echo "   init-memory-bank - to initialize memory bank in any project"
echo "\n🎯 The command will create all necessary directories automatically!" 