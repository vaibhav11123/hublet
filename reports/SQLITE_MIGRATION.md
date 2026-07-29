# SQLite Migration Notes

## Overview
The project was originally designed for PostgreSQL but has been migrated to SQLite for easier development and demonstration purposes.

## Key Changes

### Schema Changes (`prisma/schema.prisma`)
1. **Database Provider**: Changed from `postgresql` to `sqlite`
2. **Array Fields**: Converted to JSON strings
   - `Buyer.localities`: `String[]` → `String` (JSON array)
   - `Buyer.amenities`: `String[]` → `String` (JSON array)
   - `Property.amenities`: `String[]` → `String` (JSON array)
3. **JSON Fields**: Changed from `Json` type to `String` type
   - All `metadata` fields now stored as JSON strings
4. **Enum Types**: Converted to String fields with comments
   - `LeadState` enum → `String` field with valid values documented
   - `EventType` enum → `String` field with valid values documented
5. **Text Fields**: Removed `@db.Text` annotations (not needed for SQLite)
6. **JSONB**: Removed `@db.JsonB` annotations (not supported in SQLite)

### Service Layer Changes
All service files now handle JSON serialization/deserialization:

#### `buyer.service.ts`
- **Create**: Stringify `localities`, `amenities`, and `metadata` before saving
- **Get**: Parse JSON strings back to arrays/objects when retrieving
- **Update**: Stringify array/object fields before updating
- **GetAll**: Parse JSON for all buyers, filter localities in-memory

#### `property.service.ts`
- **Create**: Stringify `amenities` and `metadata` before saving
- **Get**: Parse JSON strings back to arrays/objects when retrieving
- **Update**: Stringify array/object fields before updating
- **GetAll**: Parse JSON for all properties

#### `seller.service.ts`
- **Create**: Stringify `metadata` before saving
- **Get**: Parse JSON string back to object when retrieving
- **Update**: Stringify `metadata` before updating
- **GetAll**: Parse JSON for all sellers

#### `matching.service.ts`
- **findMatchesForBuyer**: Parse `localities` and `amenities` from buyer
- **findMatchesForBuyer**: Parse `amenities` from property
- **findMatchesForProperty**: Parse `localities` and `amenities` from buyer

### Database File Location
- **Path**: `src/backend/dev.db`
- **Type**: SQLite file-based database
- **Connection String**: `file:./dev.db`

## Benefits of SQLite
1.  **Zero Configuration**: No database server to install or configure
2.  **Portable**: Single file database, easy to backup and share
3.  **Fast Setup**: Instant database creation with `prisma migrate dev`
4.  **Perfect for Development**: Ideal for prototypes and demos
5.  **Easy Deployment**: Can be easily hosted on platforms like Railway, Fly.io

## Limitations to Consider
1. ️ **Concurrency**: Limited concurrent write operations
2. ️ **Scale**: Not suitable for high-traffic production use
3. ️ **Array Queries**: No native array operations (filtered in-memory)
4. ️ **Type Safety**: JSON fields stored as strings, parsed at runtime

## Migration Path to PostgreSQL
If you need to migrate to PostgreSQL later:

1. **Update `schema.prisma`**:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Revert Field Types**:
   - Change `String` JSON fields back to `String[]` for arrays
   - Change `String` metadata fields to `Json`
   - Change String enums back to `enum` types
   - Add back `@db.Text` and `@db.JsonB` annotations

3. **Update Services**:
   - Remove `JSON.stringify()` calls when saving
   - Remove `JSON.parse()` calls when retrieving
   - Restore `Prisma.*WhereInput` types

4. **Migrate Data**:
   ```bash
   npx prisma migrate dev --name migrate_to_postgresql
   ```

## Testing
All endpoints have been tested with SQLite and work correctly:
-  Buyer creation with free-text intent parsing
-  Property creation with amenities
-  Seller management
-  Lead creation and state transitions
-  Matching algorithm with score calculation
-  Workflow event logging

## Current Status
- **Backend**: Running on port 3000 
- **Frontend**: Running on port 5173 
- **Database**: SQLite (`dev.db`) 
- **All Services**: Updated for SQLite compatibility 
