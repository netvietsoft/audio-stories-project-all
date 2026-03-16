#!/bin/bash

echo "⚠️  WARNING: This will DELETE ALL DATA in your database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

echo "🗑️  Resetting database..."
npx prisma migrate reset --force

echo "✅ Database reset complete!"
echo "📊 Running seed..."
npx prisma db seed

echo "🎉 All done! Database has been reset and seeded with new data."
