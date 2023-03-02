#!/bin/bash

rm -R slither

echo "Creating folders..."
mkdir slither

cd slither
echo "Creating report..."
slither .. 2>&1 | fgrep -v 'mixedCase' > report.txt

echo "Creating graphs..."
slither .. --print inheritance-graph &> /dev/null
slither .. --print call-graph 2>&1 | fgrep -v 'mixedCase' &> /dev/null

cd ..
