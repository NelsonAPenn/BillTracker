#!/bin/bash
ORANGE='\033[1;33m'
GREEN='\033[1;32m'
RED='\033[1;31m'
NC='\033[0m' # No Color
echo -e "${ORANGE}Getting bills...${NC}"
cd bill_tracker_node_suite
if node get_bills.js; then
  echo -e "${GREEN}Got 'em${NC}"
else
  zenity --warning --text="Encountered an error scraping some bills."
  echo -e "${RED}Encountered an error scraping some bills.${NC}"
fi
echo -e "${ORANGE}Handling bills... dry run${NC}"
if node handle_bills.js dry; then
  echo -e "${GREEN}Handled 'em${NC}"
else
  zenity --warning --text="Encountered an error handling some bills."
  echo -e "${RED}Encountered an error handling some bills.${NC}"
fi
