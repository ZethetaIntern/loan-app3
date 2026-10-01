# AWS Route 53 Application Recovery Controller (ARC) Configuration
# Provides a 5-region replicated, fault-tolerant control plane for instantaneous failover

resource "aws_route53recoverycontrolconfig_cluster" "paysecure_arc_cluster" {
  name = "paysecure-dr-control-cluster"
}

resource "aws_route53recoverycontrolconfig_control_panel" "paysecure_panel" {
  name        = "paysecure-traffic-failover-panel"
  cluster_arn = aws_route53recoverycontrolconfig_cluster.paysecure_arc_cluster.arn
}

resource "aws_route53recoverycontrolconfig_routing_control" "mumbai_control" {
  name              = "mumbai-primary-routing-control"
  cluster_arn       = aws_route53recoverycontrolconfig_cluster.paysecure_arc_cluster.arn
  control_panel_arn = aws_route53recoverycontrolconfig_control_panel.paysecure_panel.arn
}

resource "aws_route53recoverycontrolconfig_routing_control" "hyderabad_control" {
  name              = "hyderabad-dr-routing-control"
  cluster_arn       = aws_route53recoverycontrolconfig_cluster.paysecure_arc_cluster.arn
  control_panel_arn = aws_route53recoverycontrolconfig_control_panel.paysecure_panel.arn
}

# Safety Rule: Prevents Split-Brain (Ensures at least 1 region is always ACTIVE and avoids accidental total traffic blackhole)
resource "aws_route53recoverycontrolconfig_safety_rule" "split_brain_prevention" {
  name                   = "paysecure-split-brain-assertion"
  control_panel_arn      = aws_route53recoverycontrolconfig_control_panel.paysecure_panel.arn
  wait_period_ms         = 5000
  inverted               = false

  rule_config {
    inverted  = false
    threshold = 1
    type      = "ATLEAST"
  }

  asserted_controls = [
    aws_route53recoverycontrolconfig_routing_control.mumbai_control.arn,
    aws_route53recoverycontrolconfig_routing_control.hyderabad_control.arn
  ]
}

# Route 53 Health Checks linked to Routing Controls
resource "aws_route53_health_check" "mumbai_arc_health_check" {
  type                            = "RECOVERY_CONTROL"
  routing_control_arn             = aws_route53recoverycontrolconfig_routing_control.mumbai_control.arn
  invert_healthcheck              = false
  tags = {
    Name = "paysecure-mumbai-arc-hc"
  }
}

resource "aws_route53_health_check" "hyderabad_arc_health_check" {
  type                            = "RECOVERY_CONTROL"
  routing_control_arn             = aws_route53recoverycontrolconfig_routing_control.hyderabad_control.arn
  invert_healthcheck              = false
  tags = {
    Name = "paysecure-hyderabad-arc-hc"
  }
}
