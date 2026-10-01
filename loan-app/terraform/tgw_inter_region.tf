# AWS Transit Gateway Inter-Region Peering
# Connects VPCs in ap-south-1 (Mumbai) and ap-south-2 (Hyderabad) over AWS Dedicated Domestic Backbone

# Transit Gateway in Mumbai
resource "aws_ec2_transit_gateway" "tgw_mumbai" {
  description                     = "PaySecure TGW Mumbai Primary"
  amazon_side_asn                 = 64512
  auto_accept_shared_attachments  = "enable"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"

  tags = {
    Name = "paysecure-tgw-mumbai"
  }
}

# Transit Gateway in Hyderabad
resource "aws_ec2_transit_gateway" "tgw_hyderabad" {
  provider                        = aws.dr
  description                     = "PaySecure TGW Hyderabad DR"
  amazon_side_asn                 = 64513
  auto_accept_shared_attachments  = "enable"
  default_route_table_association = "enable"
  default_route_table_propagation = "enable"

  tags = {
    Name = "paysecure-tgw-hyderabad"
  }
}

# Inter-Region Peering Attachment (Initiated from Mumbai)
resource "aws_ec2_transit_gateway_peering_attachment" "mumbai_to_hyd_peering" {
  peer_account_id         = aws_ec2_transit_gateway.tgw_hyderabad.owner_id
  peer_region             = var.dr_region
  peer_transit_gateway_id = aws_ec2_transit_gateway.tgw_hyderabad.id
  transit_gateway_id      = aws_ec2_transit_gateway.tgw_mumbai.id

  tags = {
    Name = "paysecure-tgw-peering-mum-hyd"
  }
}

# Accept Peering in Hyderabad
resource "aws_ec2_transit_gateway_peering_attachment_accepter" "hyd_accept_peering" {
  provider                      = aws.dr
  transit_gateway_attachment_id = aws_ec2_transit_gateway_peering_attachment.mumbai_to_hyd_peering.id

  tags = {
    Name = "paysecure-tgw-peering-accepter-hyd"
  }
}
