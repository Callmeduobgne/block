#!/bin/bash

echo "🧹 BẮT ĐẦU DỌN DẸP HOÀN TOÀN VÀ BUILD LẠI"
echo "========================================="
echo ""

# 1. Stop và xóa tất cả containers của docker-compose
echo "1️⃣ Stopping docker-compose stack..."
cd /mnt/d/block
docker compose down -v
echo "✅ Docker compose stopped and volumes removed"
echo ""

# 2. Stop tất cả containers đang chạy
echo "2️⃣ Stopping all running containers..."
docker stop $(docker ps -aq) 2>/dev/null || echo "No containers to stop"
echo "✅ All containers stopped"
echo ""

# 3. Xóa tất cả containers
echo "3️⃣ Removing all containers..."
docker rm -f $(docker ps -aq) 2>/dev/null || echo "No containers to remove"
echo "✅ All containers removed"
echo ""

# 4. Xóa tất cả images liên quan đến project
echo "4️⃣ Removing project images..."
docker images | grep -E 'block-|blockchain|docker-' | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null
echo "✅ Project images removed"
echo ""

# 5. Xóa dangling images
echo "5️⃣ Removing dangling images..."
docker image prune -f
echo "✅ Dangling images removed"
echo ""

# 6. Xóa tất cả volumes không dùng
echo "6️⃣ Removing unused volumes..."
docker volume prune -f
echo "✅ Unused volumes removed"
echo ""

# 7. Xóa build cache
echo "7️⃣ Clearing build cache..."
docker builder prune -af
echo "✅ Build cache cleared"
echo ""

# 8. Xóa tất cả unused data
echo "8️⃣ Final cleanup - removing all unused data..."
docker system prune -af --volumes
echo "✅ System cleanup complete"
echo ""

echo "📊 Disk usage after cleanup:"
docker system df
echo ""

# 9. Rebuild tất cả images
echo "9️⃣ Rebuilding all images from scratch..."
docker compose build --no-cache
echo "✅ All images rebuilt"
echo ""

# 10. Start stack
echo "🔟 Starting fresh stack..."
docker compose up -d
echo "✅ Stack started"
echo ""

# 11. Wait for services to be ready
echo "⏳ Waiting for services to initialize (20s)..."
sleep 20
echo ""

# 12. Show status
echo "📊 FINAL STATUS:"
docker compose ps
echo ""

echo "🎉 CLEANUP VÀ REBUILD HOÀN TẤT!"

