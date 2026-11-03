# Temporary backend to manage the legacy vendedoria stack before destroy.
# After destroy + agopify bootstrap, delete this file and use backend.hcl (agopify-tfstate).
bucket       = "vendedoria-tfstate-496620607923"
key          = "prod/aws.tfstate"
region       = "us-east-1"
encrypt      = true
use_lockfile = true
