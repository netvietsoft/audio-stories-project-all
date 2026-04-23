#!/bin/bash

# Script chạy toàn bộ E2E Test cho Frontend + Backend

echo "=================================================="
echo "    Bắt đầu khởi động E2E Environment"
echo "=================================================="

# 1. Start Backend trong thư mục be/ với database test
echo "[1/3] Khởi động Backend (NODE_ENV=test)..."
cd /root/audio-stories-project-all/be
NODE_ENV=test npm run start > be_output.log 2>&1 &
BE_PID=$!
echo "Backend PID: $BE_PID ghi log vào be/be_output.log"

# Đợi Backend lên (cần cải thiện bằng ping port nhưng thôi cứ sleep 15s cho chắc)
sleep 10

# 2. Start Frontend trong thư mục fe/
echo "[2/3] Khởi động Frontend..."
cd /root/audio-stories-project-all/fe
npm run dev > fe_output.log 2>&1 &
FE_PID=$!
echo "Frontend PID: $FE_PID ghi log vào fe/fe_output.log"

# Đợi Frontend build
sleep 15

# Đảm bảo dọn dẹp khi script bị dừng hoặc hoàn thành
trap "echo 'Dọn dẹp processes...'; kill $BE_PID $FE_PID" EXIT

# 3. Chạy Playwright Tests
echo "[3/3] Bắt đầu chạy Playwright Tests..."
cd /root/audio-stories-project-all/fe
export TEST_USER_EMAIL="e2e-user@test.local"
export TEST_USER_PASSWORD="User@1234Test"
export TEST_STORY_SLUG="e2e-test-story"
npx playwright test e2e/admin-flow.spec.ts e2e/user-flow.spec.ts

PLAYWRIGHT_EXIT_CODE=$?

echo "Playwright chạy xong với exit code: $PLAYWRIGHT_EXIT_CODE"

if [ $PLAYWRIGHT_EXIT_CODE -eq 0 ]; then
    echo "✅ Toàn bộ Frontend tests PASSED!"
else
    echo "❌ Frontend tests FAILED. Xem report để debug."
fi

exit $PLAYWRIGHT_EXIT_CODE
