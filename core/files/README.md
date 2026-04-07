# @core/files

MinIO S3-compatible file storage singleton with presigned URL generation.

## Exports

| Export               | Purpose                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `./client`           | `minioClient` singleton, `uploadFile()`, `getFile()`, `listFiles()`, presigned URLs |
| `./text-file-helper` | Utilities for reading/writing text files                                            |

## Usage

```typescript
import { minioClient, uploadFile, getFile } from "@core/files/client";

await uploadFile(bucket, objectName, stream, metadata);
const file = await getFile(bucket, objectName);
```

## How It Works

Exports a singleton MinIO client configured from `@core/environment`. Provides stream-based file I/O, automatic bucket creation, presigned PUT/GET URL generation, file existence checks, deletion, and metadata queries.
