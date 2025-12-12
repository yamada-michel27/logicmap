terraform {
  backend "s3" {
    bucket  = "logicmap-tfstate-main"
    key     = "env/main/terraform.tfstate"
    region  = "ap-northeast-1"
    encrypt = true
    # profile = "default" # 必要に応じて指定
  }
}
