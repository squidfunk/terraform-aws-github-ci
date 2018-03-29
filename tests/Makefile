# Copyright (c) 2017 Martin Donath <martin.donath@squidfunk.com>

# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to
# deal in the Software without restriction, including without limitation the
# rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
# sell copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
# IN THE SOFTWARE.

all: run

# -----------------------------------------------------------------------------
# Targets
# -----------------------------------------------------------------------------

# Retrieve modules and plugins
.terraform:
	terraform init

# Update baseline plan
plans/%.tfshow: plans/%.tfshow.tmp
	cp $< $@

# Create plan from configuration
plans/%.tfshow.tmp: suites/%.tfvars .terraform
	terraform plan -var-file=$< -out $@.bin 1>/dev/null
	terraform show -no-color $@.bin | \
		sed -e "s?$(shell pwd)?.?g" > $@ && rm $@.bin

# Pseudo target to calculate the difference in plans
plans/%._diff_: plans/%.tfshow.tmp
	test -s $(basename $<) && git diff --no-index $(basename $<) $<

# -----------------------------------------------------------------------------
# Rules
# -----------------------------------------------------------------------------

# Create plans for all suites and compare them against the baseline
run: $(patsubst suites/%.tfvars, plans/%._diff_, $(shell find suites/*))

# Update baseline plans
update: $(patsubst plans/%.tmp, plans/%, $(shell find plans/*.tmp))

# -----------------------------------------------------------------------------

# Special targets
.PHONY: .FORCE test
.FORCE:

# Don't delete non-matching plans
.PRECIOUS: plans/%.tfshow.tmp
