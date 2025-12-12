variable "name" {
  type        = string
  description = "VPC名"
}

variable "cidr" {
  type        = string
  description = "VPC CIDR"
}

variable "azs" {
  type        = list(string)
  description = "利用AZ"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "パブリックサブネットCIDR"
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "プライベートサブネットCIDR"
}

variable "enable_nat_gateway" {
  type        = bool
  default     = true
  description = "NAT Gateway有効化"
}

variable "single_nat_gateway" {
  type        = bool
  default     = true
  description = "単一NAT Gateway利用"
}

variable "public_subnet_tags" {
  type        = map(string)
  default     = {}
}

variable "private_subnet_tags" {
  type        = map(string)
  default     = {}
}

variable "tags" {
  type        = map(string)
  default     = {}
}
