#!/bin/bash

echo "📊 Docker Status After Cleanup"
echo "=============================="
echo ""

echo "RUNNING CONTAINERS:"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo ""

echo "IMAGES:"
docker images | grep -E 'block-|REPOSITORY' | head -10
echo ""

echo "DISK USAGE:"
docker system df

